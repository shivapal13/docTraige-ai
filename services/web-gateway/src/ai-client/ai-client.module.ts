import { Module } from '@nestjs/common';
import { AiClientService } from './ai-client.service';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports:[
    HttpModule,
    ConfigModule.forRoot({isGlobal:true}),
  ],
  exports:[AiClientService],
  providers: [AiClientService],
})
export class AiClientModule {}
