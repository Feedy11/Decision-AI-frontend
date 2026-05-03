import { Pipe, PipeTransform } from '@angular/core';
import { ChartMetadata } from '../models/Dashboard.model';

@Pipe({ name: 'failedCharts', standalone: true })
export class FailedChartsPipe implements PipeTransform {
  transform(charts: ChartMetadata[]): ChartMetadata[] {
    return charts.filter(c => !c.execution_success);
  }
}
