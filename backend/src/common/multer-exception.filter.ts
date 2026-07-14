import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { MulterError } from 'multer';

@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(err: MulterError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
        statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
        message: 'File exceeds the size limit',
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