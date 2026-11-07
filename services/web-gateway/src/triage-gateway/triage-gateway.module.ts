import { Global, Module } from '@nestjs/common';
import { TriageGateway } from './triage-gateway';
import { JwtService } from '@nestjs/jwt';
@Global()
@Module({
  providers: [TriageGateway,JwtService],
  exports: [TriageGateway,JwtService],
})
export class TriageGatewayModule {}