import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';

const rawWsOrigins = (process.env as any).ALLOWED_ORIGINS as string | undefined;
const allowedWsOrigins = rawWsOrigins
  ? rawWsOrigins.split(',').map((o: string) => o.trim())
  : ['http://localhost:5173', 'http://localhost:3000'];

@WebSocketGateway({
  cors: {
    origin: allowedWsOrigins,
    credentials: true,
  },
  namespace: '/triage-ws',
})
export class TriageGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TriageGateway.name);
  private connectedCliniciansCount = 0;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Validates JWT token on WebSocket connection handshake and binds to hospital tenant room.
   */
  handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Unauthenticated WebSocket connection attempt rejected: ${client.id}`);
        client.disconnect(true);
        return;
      }

      // Verify JWT signature
      const secret =
        this.configService.get<string>('JWT_ACCESS_SECRET') ||
        this.configService.get<string>('JWT_SECRET') ||
        'default_jwt_access_secret';
      const payload: any = this.jwtService.verify(token, { secret });

      // Fail-closed: Must belong to a hospital
      if (!payload.hospitalId) {
        this.logger.warn(`Rejected WebSocket client ${client.id}: No hospital tenancy associated.`);
        client.disconnect(true);
        return;
      }

      client.join(`hospital_${payload.hospitalId}`);
      this.connectedCliniciansCount++;
      this.logger.log(
        `Clinician ${payload.name} (${payload.email}) connected to WebSockets in room [hospital_${payload.hospitalId}]. Active clients: ${this.connectedCliniciansCount}`,
      );
    } catch (err) {
      const errorMessage = (err as Error)?.message || 'Unknown Error';
      this.logger.warn(`Invalid WebSocket JWT Token: ${errorMessage}. Disconnecting socket ${client.id}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.connectedCliniciansCount = Math.max(0, this.connectedCliniciansCount - 1);
    this.logger.log(`Clinician disconnected: ${client.id}. Remaining: ${this.connectedCliniciansCount}`);
  }

  /**
   * Broadcasts high-priority STAT emergency alert.
   * Fail-closed: Refuses to emit to global namespace if hospitalId is absent.
   */
  broadcastStatAlert(documentPayload: any, hospitalId?: string) {
    if (!hospitalId) {
      this.logger.error(`SECURITY VIOLATION: Refusing to broadcast STAT alert ${documentPayload.id} with empty hospitalId to global namespace.`);
      return;
    }

    this.logger.warn(`BROADCASTING STAT ALERT: Doc ID ${documentPayload.id} to room [hospital_${hospitalId}]`);
    if (this.server) {
      this.server.to(`hospital_${hospitalId}`).emit('stat_alert_received', {
        timestamp: new Date().toISOString(),
        document: documentPayload,
        message: 'CRITICAL STAT RESULT DETECTED: Immediate Clinician Review Required!',
      });
    }
  }

  /**
   * Broadcasts document queue state update.
   * Fail-closed: Refuses to emit to global namespace if hospitalId is absent.
   */
  broadcastQueueUpdate(documentPayload: any, hospitalId?: string) {
    if (!hospitalId) {
      this.logger.error(`SECURITY VIOLATION: Refusing to broadcast queue update with empty hospitalId to global namespace.`);
      return;
    }

    if (this.server) {
      this.server.to(`hospital_${hospitalId}`).emit('queue_updated', {
        timestamp: new Date().toISOString(),
        document: documentPayload,
      });
    }
  }
}
