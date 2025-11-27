# DESIGN.md

## Resumen simple
Diseño para recibir datos en tiempo real desde un sportsbook (WebSocket), almacenarlos y procesarlos de forma escalable y fiable.

## Arquitectura
WebSocket sources → Ingestion (WS clients) → Message Queue (Kafka) → Stream Processors (consumers / Flink) → Storage (ClickHouse / Postgres) + Cache (Redis) → Consumers / Analytics

## Tecnologías propuestas
- WebSocket client: cliente nativo en Node (`ws`) o Go (`gorilla/websocket`)
- Message Queue: Kafka (alta tasa de mensajes, particionado)
- Stream processing: Apache Flink o Kafka Streams
- Storage: ClickHouse (analítica rápida) + Postgres (datos relacionales)
- Cache: Redis
- Lenguajes: Go/Java para alta performance; Node/Python para prototipos

## Modelo de datos
- `fixtures`: fixture_id, sport_id, teams, start_time, status
- `odds_events`: id, fixture_id, market, odd, timestamp, source
- `bets`: bet_id, user_id, stake, potential_winnings, placed_at

## Consideraciones
- Reconexión: backoff exponencial + snapshot on reconnect (si la fuente lo soporta)
- Validación: JSON Schema / pydantic antes de persistir
- Performance: particionado, batching y compresión al escribir
- Error handling: dead-letter topic + reintentos
- Monitoring: Prometheus, Grafana, alertas

## Escalado
- Aumentar particiones y consumidores en Kafka
- Escalar procesadores y shards de DB
- Usar almacenamiento OLAP para agregaciones históricas
