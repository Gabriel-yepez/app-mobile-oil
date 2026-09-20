import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateVehicleDto } from './create-vehicle.dto';

/**
 * Para editar la ficha: la pantalla manda solo lo que el usuario tocó.
 *
 * Sin `id`: el id es la identidad del vehículo, no un campo editable — y ya
 * viaja en la URL.
 */
export class UpdateVehicleDto extends PartialType(
  OmitType(CreateVehicleDto, ['id'] as const),
) {}
