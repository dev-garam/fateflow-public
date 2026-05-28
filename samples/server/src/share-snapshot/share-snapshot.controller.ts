import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateShareSnapshotDto } from './dto/create-share-snapshot.dto';
import {
  CreateShareSnapshotResponseDto,
  ShareSnapshotDeleteResponseDto,
  ShareSnapshotExpirationUpdateResponseDto,
  PublicShareSnapshotResponseDto,
  ShareSnapshotStatusUpdateResponseDto,
  ShareSnapshotTypesResponseDto,
} from './dto/share-snapshot-response.dto';
import { UpdateShareSnapshotExpirationDto } from './dto/update-share-snapshot-expiration.dto';
import { UpdateShareSnapshotStatusDto } from './dto/update-share-snapshot-status.dto';
import { ShareSnapshotService } from './share-snapshot.service';

@ApiTags('공유 스냅샷')
@Controller('v1/share-snapshots')
export class ShareSnapshotController {
  constructor(private readonly shareSnapshotService: ShareSnapshotService) {}

  @Public()
  @ApiOperation({
    summary: '공유 스냅샷 타입 목록 조회',
    description:
      '현재 공유 생성/조회 플로우에서 노출하는 스냅샷 타입과 생성 지원 여부를 반환합니다.',
  })
  @ApiOkResponse({ type: ShareSnapshotTypesResponseDto })
  @Get('types')
  getSnapshotTypes(): ShareSnapshotTypesResponseDto {
    return this.shareSnapshotService.getSnapshotTypes();
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '공유 스냅샷 생성',
    description:
      '공유 버튼 클릭 시 서버가 요청 조건으로 결과를 다시 생성하고, 그 응답을 고정 스냅샷으로 저장합니다.',
  })
  @ApiBody({ type: CreateShareSnapshotDto })
  @ApiOkResponse({ type: CreateShareSnapshotResponseDto })
  @ApiBadRequestResponse({ description: '요청 값이 유효하지 않거나 지원하지 않는 타입' })
  @Post()
  createSnapshot(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateShareSnapshotDto,
  ): Promise<CreateShareSnapshotResponseDto> {
    return this.shareSnapshotService.createSnapshot(user.userId, body);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '내 공유 스냅샷 상태 변경',
    description: '공유 URL 공개 여부를 ACTIVE, DISABLED, EXPIRED 중 하나로 변경합니다.',
  })
  @ApiParam({ name: 'shareId', description: '공유 식별자' })
  @ApiBody({ type: UpdateShareSnapshotStatusDto })
  @ApiOkResponse({ type: ShareSnapshotStatusUpdateResponseDto })
  @Patch(':shareId/status')
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('shareId') shareId: string,
    @Body() body: UpdateShareSnapshotStatusDto,
  ): Promise<ShareSnapshotStatusUpdateResponseDto> {
    return this.shareSnapshotService.updateStatus(user.userId, shareId, body.status);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '내 공유 스냅샷 만료 시각 변경',
    description: 'expiresAt을 미래 시각으로 설정하거나 null로 제거합니다.',
  })
  @ApiParam({ name: 'shareId', description: '공유 식별자' })
  @ApiBody({ type: UpdateShareSnapshotExpirationDto })
  @ApiOkResponse({ type: ShareSnapshotExpirationUpdateResponseDto })
  @Patch(':shareId/expiration')
  updateExpiration(
    @CurrentUser() user: AuthenticatedUser,
    @Param('shareId') shareId: string,
    @Body() body: UpdateShareSnapshotExpirationDto,
  ): Promise<ShareSnapshotExpirationUpdateResponseDto> {
    return this.shareSnapshotService.updateExpiration(user.userId, shareId, body.expiresAt);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: '내 공유 스냅샷 삭제',
    description: '공유 스냅샷을 soft delete 처리해 공개 조회에서 제외합니다.',
  })
  @ApiParam({ name: 'shareId', description: '공유 식별자' })
  @ApiOkResponse({ type: ShareSnapshotDeleteResponseDto })
  @Delete(':shareId')
  softDelete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('shareId') shareId: string,
  ): Promise<ShareSnapshotDeleteResponseDto> {
    return this.shareSnapshotService.softDelete(user.userId, shareId);
  }

  @Public()
  @ApiOperation({
    summary: '공유 스냅샷 공개 조회',
    description: '저장된 스냅샷을 조회하고, 공개 옵션에 맞게 개인정보성 입력값을 마스킹합니다.',
  })
  @ApiParam({ name: 'shareId', description: '공개 공유 식별자' })
  @ApiOkResponse({ type: PublicShareSnapshotResponseDto })
  @ApiNotFoundResponse({ description: '공유 스냅샷이 없거나 공개 불가능한 상태' })
  @Get(':shareId')
  getPublicSnapshot(@Param('shareId') shareId: string): Promise<PublicShareSnapshotResponseDto> {
    return this.shareSnapshotService.getPublicSnapshot(shareId);
  }
}
