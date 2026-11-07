import {
  Injectable,
  UnauthorizedException,
  Logger,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User, Hospital, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { JwtPayload } from './jwt-strategy';

export type UserWithHospital = User & { hospital: Hospital | null };

export class LoginDto {
  @IsEmail({}, { message: 'A valid hospital email address is required.' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Password cannot be empty.' })
  password: string;

  @IsOptional()
  @IsString()
  device?: string;
}

export class SignUpDto {
  @IsEmail({}, { message: 'A valid hospital email address is required.' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long.' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Clinician name is required.' })
  name: string;

  @IsOptional()
  @IsEnum(UserRole, { message: 'Role must be DOCTOR or NURSE.' })
  role?: UserRole;

  @IsOptional()
  @IsString()
  hospitalName?: string;

  @IsOptional()
  @IsString()
  joinCode?: string;

  @IsOptional()
  @IsString()
  device?: string;
}

export class RefreshTokenDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {}

  /**
   * Cryptographically signs both short-lived Access Token (15m) and long-lived Refresh Token (7d)
   * with hospital tenant isolation claims.
   */
  private async generateTokens(
    userId: string,
    email: string,
    role: string,
    name: string,
    hospitalId?: string | null,
    hospitalName?: string | null,
  ) {
    const jti = crypto.randomUUID();
    const payload = {
      sub: userId,
      email,
      role,
      name,
      hospitalId: hospitalId || null,
      hospitalName: hospitalName || null,
      jti,
    };

    const accessSecret =
      this.configService.get<string>('JWT_ACCESS_SECRET') ||
      this.configService.get<string>('JWT_SECRET') ||
      'default_jwt_access_secret';

    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      accessSecret + '_refresh';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...payload, tokenType: 'access' },
        { secret: accessSecret, expiresIn: '15m' },
      ),
      this.jwtService.signAsync(
        { ...payload, tokenType: 'refresh' },
        { secret: refreshSecret, expiresIn: '7d' },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
      jti,
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  /**
   * Pre-hashes arbitrary-length JWT tokens with SHA-256 to ensure the payload
   * remains safely under Bcrypt's strict 72-byte truncation threshold.
   */
  private hashTokenForStorage(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Stores a new refresh token session in the database for multi-device support.
   */
  private async storeRefreshToken(
    userId: string,
    refreshToken: string,
    jti: string,
    device?: string,
  ) {
    const prehashed = this.hashTokenForStorage(refreshToken);
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(prehashed, salt);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.prismaService.refreshToken.create({
      data: {
        userId,
        tokenHash: hash,
        jti,
        device: device || null,
        expiresAt,
      },
    });
  }

  /**
   * Clinical Registration: Enforces strict tenant separation.
   * - Cannot hijack an existing hospital without its Facility Join Code.
   * - Creating a new hospital generates a unique Join Code and sets creator as ADMIN.
   */
  async signUp(dto: SignUpDto) {
    const email = dto.email.toLowerCase().trim();

    const existing = await this.prismaService.user.findUnique({
      where: { email },
    });
    if (existing) {
      throw new ConflictException('Email is already registered.');
    }

    let hospital: Hospital;
    let assignedRole: UserRole = dto.role === UserRole.ADMIN ? UserRole.DOCTOR : (dto.role || UserRole.DOCTOR);

    if (dto.joinCode && dto.joinCode.trim()) {
      // Case 1: Joining an existing hospital with authorized join code
      const code = dto.joinCode.trim().toUpperCase();
      const foundHospital = await this.prismaService.hospital.findUnique({
        where: { joinCode: code },
      });
      if (!foundHospital) {
        throw new BadRequestException('Invalid Facility Join Code. Please verify the code with your hospital administrator.');
      }
      hospital = foundHospital;
    } else if (dto.hospitalName && dto.hospitalName.trim()) {
      // Case 2: Registering a NEW hospital
      const rawHospitalName = dto.hospitalName.trim();
      const slug = rawHospitalName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'hospital-' + crypto.randomBytes(3).toString('hex');

      // Security check: Reject if hospital already exists without a join code
      const existingHospital = await this.prismaService.hospital.findFirst({
        where: {
          OR: [
            { slug },
            { name: { equals: rawHospitalName, mode: 'insensitive' } },
          ],
        },
      });

      if (existingHospital) {
        throw new ConflictException(
          `Facility "${rawHospitalName}" is already registered. To join this facility, please enter its authorized Facility Join Code.`,
        );
      }

      // Generate a cryptographically unique join code for the new facility
      const newJoinCode = `FAC-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      hospital = await this.prismaService.hospital.create({
        data: {
          name: rawHospitalName,
          slug,
          joinCode: newJoinCode,
        },
      });
      // The founding user of a new hospital facility becomes its ADMIN
      assignedRole = UserRole.ADMIN;
      this.logger.log(`Created new hospital: "${hospital.name}" with Join Code: ${newJoinCode}`);
    } else {
      throw new BadRequestException('Hospital identification required: Provide a Hospital Name to register a new facility or a Join Code to join an existing one.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);
    const user = await this.prismaService.user.create({
      data: {
        email,
        passwordHash,
        name: dto.name.trim(),
        role: assignedRole,
        hospitalId: hospital.id,
      },
    });

    this.logger.log(`Registered clinician: ${user.name} (${user.role}) for ${hospital.name}`);

    // Generate dual token pair with hospital tenant claim
    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.role,
      user.name,
      hospital.id,
      hospital.name,
    );
    await this.storeRefreshToken(user.id, tokens.refreshToken, tokens.jti, dto.device);

    return {
      message: 'Registration successful.',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenType: 'Bearer',
      expiresIn: tokens.expiresIn,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        hospitalId: hospital.id,
        hospitalName: hospital.name,
        joinCode: assignedRole === UserRole.ADMIN ? hospital.joinCode : undefined,
        hospital: {
          id: hospital.id,
          name: hospital.name,
          slug: hospital.slug,
        },
      },
    };
  }

  /**
   * Clinical Login: Validates credentials with constant-time response and isActive check.
   */
  async login(dto: LoginDto) {
    if (!dto.email || !dto.password) {
      throw new BadRequestException('Email and password are required.');
    }

    const email = dto.email.toLowerCase().trim();
    const user = (await this.prismaService.user.findUnique({
      where: { email },
      include: { hospital: true },
    })) as UserWithHospital | null;

    // Constant-time timing attack protection:
    // If user does not exist, run a dummy bcrypt compare against a precomputed hash
    // so response timing is ~50ms in both cases (preventing user enumeration).
    const DUMMY_HASH = '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUU123456';
    if (!user) {
      await bcrypt.compare(dto.password, DUMMY_HASH);
      this.logger.warn(`Login attempt with unknown email: ${email}`);
      throw new UnauthorizedException('Invalid user credentials.');
    }

    // Check account active status
    if (user.isActive === false) {
      this.logger.warn(`Deactivated user login attempt: ${email}`);
      throw new UnauthorizedException('Account has been deactivated. Please contact your hospital administrator.');
    }

    // Check hospital tenant binding
    if (!user.hospitalId || !user.hospital) {
      this.logger.warn(`User ${email} has no hospital tenant bound.`);
      throw new UnauthorizedException('Tenancy error: Account is not bound to a verified hospital.');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      this.logger.warn(`Failed login password attempt for user: ${email}`);
      throw new UnauthorizedException('Invalid user credentials.');
    }

    const hospitalId = user.hospitalId;
    const hospitalName = user.hospital.name;

    // Generate dual token pair
    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.role,
      user.name,
      hospitalId,
      hospitalName,
    );
    await this.storeRefreshToken(user.id, tokens.refreshToken, tokens.jti, dto.device);

    // Update lastLoginAt
    await this.prismaService.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    this.logger.log(`Session established for clinician: ${user.email} [${hospitalName}]`);

    return {
      message: 'Authentication successful.',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenType: 'Bearer',
      expiresIn: tokens.expiresIn,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        hospitalId,
        hospitalName,
        hospital: {
          id: user.hospital.id,
          name: user.hospital.name,
          slug: user.hospital.slug,
        },
      },
    };
  }

  /**
   * Token Refresh with Multi-Device Session Isolation and Replay Attack Protection.
   */
  async refreshTokens(dto: RefreshTokenDto) {
    if (!dto.refreshToken) {
      throw new BadRequestException('Refresh token is required.');
    }

    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      (this.configService.get<string>('JWT_SECRET') || 'default_jwt_access_secret') + '_refresh';

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(dto.refreshToken, { secret: refreshSecret });
    } catch (err) {
      this.logger.warn(`Invalid or expired refresh token: ${(err as Error).message}`);
      throw new UnauthorizedException('Invalid or expired refresh token. Please sign in again.');
    }

    if (!payload?.sub || payload.tokenType !== 'refresh' || !payload.jti) {
      throw new UnauthorizedException('Malformed token: Not a valid refresh token.');
    }

    const user = (await this.prismaService.user.findUnique({
      where: { id: payload.sub },
      include: { hospital: true },
    })) as UserWithHospital | null;

    if (!user || user.isActive === false) {
      throw new UnauthorizedException('Access Denied: Account inactive or revoked.');
    }

    // Multi-device session lookup by jti
    const storedSession = await this.prismaService.refreshToken.findUnique({
      where: { jti: payload.jti },
    });

    if (!storedSession || storedSession.userId !== user.id) {
      // SECURITY: Potential Replay Attack Detected!
      // Invalidate all active sessions for this compromised user immediately.
      this.logger.error(
        `SECURITY ALERT: Replay attack detected for user ID: ${user.id} on jti ${payload.jti}. Revoking all sessions!`,
      );
      await this.prismaService.refreshToken.deleteMany({
        where: { userId: user.id },
      });
      throw new UnauthorizedException('Security Breach: Token reuse detected. All sessions revoked.');
    }

    // Verify stored hash against provided refresh token using SHA-256 pre-hashing
    const prehashedInput = this.hashTokenForStorage(dto.refreshToken);
    const isTokenMatch = await bcrypt.compare(prehashedInput, storedSession.tokenHash);

    if (!isTokenMatch) {
      await this.prismaService.refreshToken.deleteMany({
        where: { userId: user.id },
      });
      throw new UnauthorizedException('Security Breach: Token hash mismatch. Session revoked.');
    }

    // Delete the consumed refresh token session (Single-use rotation)
    await this.prismaService.refreshToken.delete({
      where: { id: storedSession.id },
    });

    const hospitalId = user.hospitalId || user.hospital?.id || null;
    const hospitalName = user.hospital?.name || null;

    // Issue new pair (Rotation) with new jti
    const newTokens = await this.generateTokens(
      user.id,
      user.email,
      user.role,
      user.name,
      hospitalId,
      hospitalName,
    );
    await this.storeRefreshToken(
      user.id,
      newTokens.refreshToken,
      newTokens.jti,
      storedSession.device || undefined,
    );

    this.logger.log(`Rotated refresh token session for user ID: ${user.id} (device: ${storedSession.device || 'default'})`);

    return {
      message: 'Token refresh successful.',
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
      tokenType: 'Bearer',
      expiresIn: newTokens.expiresIn,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        hospitalId,
        hospitalName,
        hospital: user.hospital
          ? {
              id: user.hospital.id,
              name: user.hospital.name,
              slug: user.hospital.slug,
            }
          : undefined,
      },
    };
  }

  /**
   * Clinical Logout: Revokes the user's active refresh token sessions.
   */
  async logout(userId: string) {
    await this.prismaService.refreshToken.deleteMany({
      where: { userId },
    });
    this.logger.log(`User ID ${userId} logged out; all refresh tokens revoked.`);
    return {
      message: 'Successfully logged out. Refresh token revoked.',
    };
  }

  /**
   * Retrieves profile of currently authenticated clinician.
   */
  async getProfile(userId: string) {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        hospitalId: true,
        hospital: {
          select: {
            id: true,
            name: true,
            slug: true,
            joinCode: true,
          },
        },
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Clinician account not found.');
    }

    return user;
  }
}
