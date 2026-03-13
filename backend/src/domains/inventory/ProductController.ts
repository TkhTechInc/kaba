import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProductService } from './services/ProductService';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { Auth } from '@/nest/common/decorators/auth.decorator';
import { Feature } from '@/nest/common/decorators/feature.decorator';
import { FeatureGuard } from '@/nest/common/guards/feature.guard';
import { PermissionGuard } from '@/nest/common/guards/permission.guard';
import { RequirePermission } from '@/nest/common/decorators/require-permission.decorator';

@Controller('api/v1/products')
@Auth()
@UseGuards(FeatureGuard, PermissionGuard)
@Feature('inventory_lite')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @RequirePermission('inventory:write')
  async create(@Body() dto: CreateProductDto) {
    const product = await this.productService.create({
      businessId: dto.businessId,
      name: dto.name,
      brand: dto.brand,
      unitPrice: dto.unitPrice,
      currency: dto.currency,
      quantityInStock: dto.quantityInStock,
      lowStockThreshold: dto.lowStockThreshold,
    });
    return { success: true, data: product };
  }

  @Get()
  @RequirePermission('inventory:read')
  async list(
    @Query() query: ListProductsQueryDto,
    @Query('cursor') cursor?: string,
  ) {
    if (cursor !== undefined) {
      const result = await this.productService.listWithCursor(
        query.businessId,
        query.limit ?? 50,
        cursor || undefined,
      );
      return { success: true, data: result };
    }
    const result = await this.productService.list(
      query.businessId,
      query.page ?? 1,
      query.limit ?? 50
    );
    return {
      success: true,
      data: {
        items: result.items,
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    };
  }

  @Get(':id')
  @RequirePermission('inventory:read')
  async getById(@Param('id') id: string, @Query('businessId') businessId: string) {
    const product = await this.productService.getById(businessId, id);
    return { success: true, data: product };
  }

  @Patch(':id')
  @RequirePermission('inventory:write')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    const product = await this.productService.update(dto.businessId, id, {
      name: dto.name,
      brand: dto.brand,
      unitPrice: dto.unitPrice,
      currency: dto.currency,
      quantityInStock: dto.quantityInStock,
      lowStockThreshold: dto.lowStockThreshold,
    });
    return { success: true, data: product };
  }

  @Delete(':id')
  @RequirePermission('inventory:write')
  async delete(
    @Param('id') id: string,
    @Query('businessId') businessId: string
  ) {
    await this.productService.delete(businessId, id);
    return { success: true };
  }
}
