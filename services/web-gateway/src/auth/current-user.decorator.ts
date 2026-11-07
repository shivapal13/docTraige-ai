import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export class CurrentUserPayload {
  userId: string;
  email: string;
  role: string;
  name: string;
  hospitalId?: string;
  hospitalName?: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
