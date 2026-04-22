import { Controller, Get, Post, Body, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  create(@Request() req, @Body() createCommentDto: CreateCommentDto) {
    return this.commentsService.create(req.user.tenantId, req.user.id, createCommentDto);
  }

  @Get()
  findAllByEntity(
    @Request() req,
    @Query('entityType') entityType: string,
    @Query('entityId') entityId: string,
  ) {
    return this.commentsService.findAllByEntity(req.user.tenantId, entityType, entityId);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.commentsService.remove(id, req.user.tenantId, req.user.id, req.user.role);
  }
}
