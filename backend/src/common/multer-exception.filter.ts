import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { MulterError } from 'multer';

/**
 * Maps multer upload errors to proper HTTP responses.
 * - LIMIT_FILE_SIZE (>2MB avatar, A-007) -> 413 Payload Too Large
 * - any other multer error -> 400 Bad Request
 * Applied at the avatar upload route (ADLAAAA-10, Slice 3).
 */
@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(err: MulterError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
        statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
        message: 'Avatar exceeds the 2MB size limit',
        error: 'Payload Too Large',
      });
    }

    return res.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      message: err.message,
      error: 'Bad Request',
    });
  }
}
