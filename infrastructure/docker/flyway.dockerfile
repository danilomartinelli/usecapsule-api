FROM flyway/flyway:9.22.3-alpine

# Copy configuration files
COPY ./infrastructure/flyway/ /flyway/conf/
COPY ./infrastructure/migrations/ /flyway/sql/

# Default command
CMD ["migrate"]