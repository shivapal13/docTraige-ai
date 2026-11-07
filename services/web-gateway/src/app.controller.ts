import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller('/health')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHealth(){
    return {
      status: 'online',
      service: 'DocTriage AI Web Gateway Is Running',
      timestamp: new Date().toUTCString(),
    }
  }
}
