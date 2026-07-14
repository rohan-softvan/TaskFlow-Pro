import { SetMetadata } from '@nestjs/common';

export const SKIP_MUST_RESET_PW_KEY = 'skipMustResetPw';
export const SkipMustResetPassword = () =>
  SetMetadata(SKIP_MUST_RESET_PW_KEY, true);