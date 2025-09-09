import { DriverTypeParser } from 'slonik';

export function createTypeParsers(): DriverTypeParser[] {
  return [
    {
      name: 'uuid',
      parse: (value: string) => value,
    },
    {
      name: 'json',
      parse: (value: string) => JSON.parse(value),
    },
    {
      name: 'jsonb',
      parse: (value: string) => JSON.parse(value),
    },
    {
      name: 'date',
      parse: (value: string) => new Date(value),
    },
    {
      name: 'timestamp',
      parse: (value: string) => new Date(value),
    },
    {
      name: 'timestamptz',
      parse: (value: string) => new Date(value),
    },
    {
      name: 'int8',
      parse: (value: string) => BigInt(value),
    },
    {
      name: 'numeric',
      parse: (value: string) => parseFloat(value),
    },
    {
      name: 'decimal',
      parse: (value: string) => parseFloat(value),
    },
  ];
}
