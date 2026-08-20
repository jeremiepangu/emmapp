import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ContractsService } from './contracts.service';
import {
  ArchiveDocumentDto,
  CreateAmendmentDto,
  CreateContractDto,
  CreateSupplierDto,
  CreateTemplateDto,
  ContractQueryDto,
  GenerateWordDto,
  RenewContractDto,
  TerminateContractDto,
  UpdateContractDto,
  UpdateSupplierDto,
  UpdateTemplateDto,
  UploadSignedDto,
} from './dto/contract.dto';

const WRITE = [
  UserRole.ADMIN,
  UserRole.RH,
  UserRole.COMMERCIAL,
  UserRole.COMPTABLE,
  UserRole.MAGASINIER,
] as const;

const VALIDATE = [
  UserRole.ADMIN,
  UserRole.RH,
  UserRole.DG,
  UserRole.COMMERCIAL,
  UserRole.COMPTABLE,
] as const;

@ApiTags('contracts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('contracts')
export class ContractsController {
  constructor(private contracts: ContractsService) {}

  @Get()
  list(@Query() query: ContractQueryDto) {
    return this.contracts.findAll(query);
  }

  @Get('summary')
  summary() {
    return this.contracts.summary();
  }

  @Get('parties')
  parties() {
    return this.contracts.parties();
  }

  @Get('suppliers')
  suppliers() {
    return this.contracts.listSuppliers();
  }

  @Get('placeholders')
  placeholders() {
    return this.contracts.placeholders();
  }

  @Get('templates')
  templates() {
    return this.contracts.listTemplates();
  }

  @Roles(...WRITE)
  @Post('templates')
  createTemplate(@Body() dto: CreateTemplateDto) {
    return this.contracts.createTemplate(dto);
  }

  @Roles(...WRITE)
  @Patch('templates/:id')
  updateTemplate(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.contracts.updateTemplate(id, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.RH)
  @Delete('templates/:id')
  deactivateTemplate(@Param('id') id: string) {
    return this.contracts.deactivateTemplate(id);
  }

  @Get('archives')
  archives() {
    return this.contracts.listArchives();
  }

  @Get('documents/:docId/file')
  async download(@Param('docId') docId: string, @Res({ passthrough: true }) res: Response) {
    const doc = await this.contracts.getDocumentFile(docId);
    res.set({
      'Content-Type': doc.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(doc.filename)}"`,
    });
    return new StreamableFile(Buffer.from(doc.content));
  }

  @Roles(...WRITE)
  @Post('suppliers')
  createSupplier(@Body() dto: CreateSupplierDto) {
    return this.contracts.createSupplier(dto);
  }

  @Roles(...WRITE)
  @Patch('suppliers/:id')
  updateSupplier(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.contracts.updateSupplier(id, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.RH, UserRole.MAGASINIER)
  @Delete('suppliers/:id')
  deactivateSupplier(@Param('id') id: string) {
    return this.contracts.deactivateSupplier(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contracts.findOne(id);
  }

  @Roles(...WRITE)
  @Post()
  create(@Body() dto: CreateContractDto) {
    return this.contracts.create(dto);
  }

  @Roles(...WRITE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateContractDto) {
    return this.contracts.update(id, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.RH)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.contracts.remove(id);
  }

  @Roles(...VALIDATE)
  @Post(':id/validate')
  validate(@Param('id') id: string, @Req() req: { user: { id: string } }) {
    return this.contracts.validate(id, req.user.id);
  }

  @Roles(...VALIDATE)
  @Post(':id/suspend')
  suspend(@Param('id') id: string) {
    return this.contracts.suspend(id);
  }

  @Roles(...VALIDATE)
  @Post(':id/resume')
  resume(@Param('id') id: string) {
    return this.contracts.resume(id);
  }

  @Roles(...VALIDATE)
  @Post(':id/renew')
  renew(@Param('id') id: string, @Body() dto: RenewContractDto) {
    return this.contracts.renew(id, dto);
  }

  @Roles(...VALIDATE)
  @Post(':id/terminate')
  terminate(@Param('id') id: string, @Body() dto: TerminateContractDto) {
    return this.contracts.terminate(id, dto);
  }

  @Roles(...WRITE)
  @Post(':id/amendments')
  amend(@Param('id') id: string, @Body() dto: CreateAmendmentDto) {
    return this.contracts.addAmendment(id, dto);
  }

  @Roles(...WRITE)
  @Post(':id/generate-word')
  generateWord(@Param('id') id: string, @Body() dto: GenerateWordDto) {
    return this.contracts.generateWord(id, dto);
  }

  @Roles(...WRITE)
  @Post(':id/documents/:docId/archive')
  archive(
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Req() req: { user: { id: string } },
    @Body() dto: ArchiveDocumentDto,
  ) {
    return this.contracts.archiveDocument(id, docId, req.user.id, dto);
  }

  @Roles(...WRITE)
  @Post(':id/archive-signed')
  uploadSigned(
    @Param('id') id: string,
    @Req() req: { user: { id: string } },
    @Body() dto: UploadSignedDto,
  ) {
    return this.contracts.uploadSigned(id, req.user.id, dto);
  }
}
