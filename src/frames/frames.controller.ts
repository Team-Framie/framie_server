import { Controller, Get, Param, Query } from '@nestjs/common';
import { FramesService } from './frames.service';

@Controller('frames')
export class FramesController {
  constructor(private readonly framesService: FramesService) {}

  @Get()
  findAll(
    @Query('shot_count') shotCount?: string,
    @Query('title') title?: string,
  ) {
    return this.framesService.findAll(
      shotCount ? parseInt(shotCount, 10) : undefined,
      title,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.framesService.findOne(id);
  }
}
