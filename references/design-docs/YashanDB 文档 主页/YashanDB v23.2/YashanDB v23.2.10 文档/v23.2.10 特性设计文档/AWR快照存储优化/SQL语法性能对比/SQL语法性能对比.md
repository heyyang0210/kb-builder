

### SQL语法：

**1.rownumber():**

```
SELECT sa.first_load_location, sa.sql_id, sa.plan_hash_value, sa.optimizer_cost, sa.optimizer_mode, sa.optimizer_env_hash_value, sa.sharable_mem, sa.loaded_versions,
                          sa.version_count, sa.module, sa.action, NULL, NULL, sa.parsing_schema_id, sa.parsing_schema_name, sa.fetches, fetches_delta,
						  sa.end_of_fetch_count, end_of_fetch_count_delta, sa.sorts, sorts_delta, sa.executions, executions_delta, sa.px_servers_executions, px_servers_executions_delta,
						  sa.loads, loads_delta, sa.invalidations, invalidations_delta, sa.parse_calls, parse_calls_delta, sa.disk_reads, disk_reads_delta,
						  sa.buffer_gets, buffer_gets_delta, sa.rows_processed, rows_processed_delta, sa.cpu_time/1000, cpu_time_delta/1000, sa.elapsed_time/1000, elapsed_time_delta/1000,
						  sa.user_io_wait_time/1000, user_io_wait_time_delta/1000, sa.cluster_wait_time/1000, cluster_wait_time_delta/1000, sa.application_wait_time/1000, application_wait_time_delta/1000,
						  sa.concurrency_wait_time/1000, concurrency_wait_time_delta, sa.direct_writes, direct_writes_delta, sa.plsql_exec_time/1000, plsql_exec_time_delta/1000, 0, 0, sa.bind_data, NULL, sa.parsing_user_id,
						  sa.io_interconnect_bytes, io_interconnect_bytes_delta, sa.physical_read_requests, physical_read_requests_delta, sa.physical_read_bytes, physical_read_bytes_delta,
						  sa.physical_write_requests, physical_write_requests_delta, sa.physical_write_bytes, physical_write_bytes_delta, 0
				     FROM
				         (select first_load_location, sql_id, plan_hash_value, optimizer_cost, optimizer_mode, optimizer_env_hash_value, sharable_mem, loaded_versions,
					         version_count, module, action, parsing_schema_id, parsing_schema_name, fetches, fetches_delta,
							 end_of_fetch_count, end_of_fetch_count_delta, sorts, sorts_delta, executions, executions_delta, px_servers_executions, px_servers_executions_delta,
							 loads, loads_delta, invalidations, invalidations_delta, parse_calls, parse_calls_delta, disk_reads, disk_reads_delta,
							 buffer_gets, buffer_gets_delta, rows_processed, rows_processed_delta, cpu_time, cpu_time_delta, elapsed_time, elapsed_time_delta,
							 user_io_wait_time, user_io_wait_time_delta, cluster_wait_time, cluster_wait_time_delta, application_wait_time, application_wait_time_delta,
							 concurrency_wait_time, concurrency_wait_time_delta, direct_writes, direct_writes_delta, plsql_exec_time, plsql_exec_time_delta, bind_data, parsing_user_id,
							 io_interconnect_bytes, io_interconnect_bytes_delta, physical_read_requests, physical_read_requests_delta, physical_read_bytes, physical_read_bytes_delta,
							 physical_write_requests, physical_write_requests_delta, physical_write_bytes, physical_write_bytes_delta,
                             row_number() over(order by elapsed_time_delta desc) elapsed_time_delta_rank,
                             row_number() over(order by cpu_time_delta desc) cpu_time_delta_rank,
                             row_number() over(order by parse_calls_delta desc) parse_calls_delta_rank,
                             row_number() over(order by sharable_mem desc) sharable_mem_rank
                         from (select * from x$sqlarea where elapsed_time_delta > 0 or cpu_time_delta > 0 or parse_calls_delta > 0)
                         ) sa
					 where
                         (elapsed_time_delta_rank <= 30 or cpu_time_delta_rank <= 30 or parse_calls_delta_rank <= 30 or sharable_mem_rank <= 30)
	                     and (elapsed_time_delta > 0 or cpu_time_delta > 0 or parse_calls_delta > 0);

```

计划：

![WXWorkLocalPro_17361479651479.png](https://pingcode.yasdb.com/atlas/files/public/677b840aa1ad9a3311de60bb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBZ0NBQUFBQUJFQUFBQUJBQVFBQUFBQUFBQUFJQUFBQUFBQUFBQUFnQUFBQUFBQUFJQUFBQUFBQUFFQUFCQUFBRUFLQUFBQUFBQUFBQUlBQUFBQUFBQUFBQ1VFQkFFQUFBQUFBQUFBQUFBRUFBQUFBQUFBaEFBQVFBQUFBQWdBQUFCQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNDUyNjIsImV4cCI6MTc4MjM1NjA2Mn0.dMWKTk19YJ1ZquGQ3BuKIyGaDkCMKz49-TdRPLkkcdU)



**2.union:**

```
WITH ranked_sql AS(
select first_load_location, sql_id, plan_hash_value, optimizer_cost, optimizer_mode, optimizer_env_hash_value, sharable_mem, loaded_versions,
					         version_count, module, action, parsing_schema_id, parsing_schema_name, fetches, fetches_delta,
							 end_of_fetch_count, end_of_fetch_count_delta, sorts, sorts_delta, executions, executions_delta, px_servers_executions, px_servers_executions_delta,
							 loads, loads_delta, invalidations, invalidations_delta, parse_calls, parse_calls_delta, disk_reads, disk_reads_delta,
							 buffer_gets, buffer_gets_delta, rows_processed, rows_processed_delta, cpu_time, cpu_time_delta, elapsed_time, elapsed_time_delta,
							 user_io_wait_time, user_io_wait_time_delta, cluster_wait_time, cluster_wait_time_delta, application_wait_time, application_wait_time_delta,
							 concurrency_wait_time, concurrency_wait_time_delta, direct_writes, direct_writes_delta, plsql_exec_time, plsql_exec_time_delta, bind_data, parsing_user_id,
							 io_interconnect_bytes, io_interconnect_bytes_delta, physical_read_requests, physical_read_requests_delta, physical_read_bytes, physical_read_bytes_delta,
							 physical_write_requests, physical_write_requests_delta, physical_write_bytes, physical_write_bytes_delta
FROM x$SQLAREA
where elapsed_time_delta >0 or cpu_time_delta >0 or parse_calls_delta >0  
)
(SELECT * FROM ranked_sql order by elapsed_time_delta desc limit 30) union (SELECT * FROM ranked_sql order by cpu_time_delta desc limit 30) 
union (SELECT * FROM ranked_sql order by parse_calls_delta desc limit 30) union (SELECT * FROM ranked_sql order by sharable_mem desc limit 30);	
```

计划：

![WXWorkLocalPro_17361481329359.png](https://pingcode.yasdb.com/atlas/files/public/677b84b5a1ad9a3311de60be/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBZ0NBQUFBQUJFQUFBQUJBQVFBQUFBQUFBQUFJQUFBQUFBQUFBQUFnQUFBQUFBQUFJQUFBQUFBQUFFQUFCQUFBRUFLQUFBQUFBQUFBQUlBQUFBQUFBQUFBQ1VFQkFFQUFBQUFBQUFBQUFBRUFBQUFBQUFBaEFBQVFBQUFBQWdBQUFCQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNDUyNjIsImV4cCI6MTc4MjM1NjA2Mn0.dMWKTk19YJ1ZquGQ3BuKIyGaDkCMKz49-TdRPLkkcdU)



**3.left join => NESTED LOOPS FULL OUTER**

```
WITH ranked_sql AS(
select first_load_location, sql_id, plan_hash_value, optimizer_cost, optimizer_mode, optimizer_env_hash_value, sharable_mem, loaded_versions,
					         version_count, module, action, parsing_schema_id, parsing_schema_name, fetches, fetches_delta,
							 end_of_fetch_count, end_of_fetch_count_delta, sorts, sorts_delta, executions, executions_delta, px_servers_executions, px_servers_executions_delta,
							 loads, loads_delta, invalidations, invalidations_delta, parse_calls, parse_calls_delta, disk_reads, disk_reads_delta,
							 buffer_gets, buffer_gets_delta, rows_processed, rows_processed_delta, cpu_time, cpu_time_delta, elapsed_time, elapsed_time_delta,
							 user_io_wait_time, user_io_wait_time_delta, cluster_wait_time, cluster_wait_time_delta, application_wait_time, application_wait_time_delta,
							 concurrency_wait_time, concurrency_wait_time_delta, direct_writes, direct_writes_delta, plsql_exec_time, plsql_exec_time_delta, bind_data, parsing_user_id,
							 io_interconnect_bytes, io_interconnect_bytes_delta, physical_read_requests, physical_read_requests_delta, physical_read_bytes, physical_read_bytes_delta,
							 physical_write_requests, physical_write_requests_delta, physical_write_bytes, physical_write_bytes_delta
FROM x$SQLAREA
where elapsed_time_delta >0 or cpu_time_delta >0 or parse_calls_delta >0  
)
SELECT * FROM (select * from ranked_sql order by elapsed_time_delta desc limit 30) a
   full join (SELECT * FROM ranked_sql order by cpu_time_delta desc limit 30) b on a.sql_id = b.sql_id and a.first_load_location = b.first_load_location
   full join (SELECT * FROM ranked_sql order by parse_calls_delta desc limit 30) c on (c.sql_id = b.sql_id and c.first_load_location = b.first_load_location) or (c.sql_id = a.sql_id and c.first_load_location = a.first_load_location)
   full join (SELECT * FROM ranked_sql order by sharable_mem desc limit 30) d on (c.sql_id = d.sql_id and c.first_load_location = d.first_load_location) or (b.sql_id = d.sql_id and b.first_load_location = d.first_load_location) or (a.sql_id = d.sql_id and a.first_load_location = d.first_load_location);
   
```

计划：

![WXWorkLocalPro_173613339442.png](https://pingcode.yasdb.com/atlas/files/public/677b8534a1ad9a3311de60bf/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBZ0NBQUFBQUJFQUFBQUJBQVFBQUFBQUFBQUFJQUFBQUFBQUFBQUFnQUFBQUFBQUFJQUFBQUFBQUFFQUFCQUFBRUFLQUFBQUFBQUFBQUlBQUFBQUFBQUFBQ1VFQkFFQUFBQUFBQUFBQUFBRUFBQUFBQUFBaEFBQVFBQUFBQWdBQUFCQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNDUyNjIsImV4cCI6MTc4MjM1NjA2Mn0.dMWKTk19YJ1ZquGQ3BuKIyGaDkCMKz49-TdRPLkkcdU)



**4.left join => HASH JOIN FULL OUTER**

```
WITH ranked_sql AS(
select * FROM x$SQLAREA
where elapsed_time_delta >0 or cpu_time_delta >0 or parse_calls_delta >0  
)
select COALESCE(ac.sql_id, d.sql_id) as sql_id, COALESCE(ac.first_load_location, d.first_load_location) as first_load_location, COALESCE(ac.elapsed_time_delta, d.elapsed_time_delta) as elapsed_time_delta, COALESCE(ac.cpu_time_delta, d.cpu_time_delta) as cpu_time_delta,
	COALESCE(ac.parse_calls_delta, d.parse_calls_delta) as parse_calls_delta, COALESCE(ac.sharable_mem, d.sharable_mem) as sharable_mem, COALESCE(ac.plan_hash_value, d.plan_hash_value) as plan_hash_value, COALESCE(ac.optimizer_cost, d.optimizer_cost) as optimizer_cost,
	COALESCE(ac.optimizer_mode, d.optimizer_mode) as optimizer_mode, COALESCE(ac.optimizer_env_hash_value, d.optimizer_env_hash_value) as optimizer_env_hash_value, COALESCE(ac.loaded_versions, d.loaded_versions) as loaded_versions, COALESCE(ac.version_count, d.version_count) as version_count,
	COALESCE(ac.module, d.module) as module, COALESCE(ac.action, d.action) as action, COALESCE(ac.parsing_schema_id, d.parsing_schema_id) as parsing_schema_id, COALESCE(ac.parsing_schema_name, d.parsing_schema_name) as parsing_schema_name,
	COALESCE(ac.fetches, d.fetches) as fetches, COALESCE(ac.fetches_delta, d.fetches_delta) as fetches_delta, COALESCE(ac.end_of_fetch_count, d.end_of_fetch_count) as end_of_fetch_count, COALESCE(ac.end_of_fetch_count_delta, d.end_of_fetch_count_delta) as end_of_fetch_count_delta,
	COALESCE(ac.sorts, d.sorts) as sorts, COALESCE(ac.sorts_delta, d.sorts_delta) as sorts_delta, COALESCE(ac.executions, d.executions) as executions, COALESCE(ac.executions_delta, d.executions_delta) as executions_delta,
	COALESCE(ac.px_servers_executions, d.px_servers_executions) as px_servers_executions, COALESCE(ac.px_servers_executions_delta, d.px_servers_executions_delta) as px_servers_executions_delta, COALESCE(ac.loads, d.loads) as loads, COALESCE(ac.loads_delta, d.loads_delta) as loads_delta,
	COALESCE(ac.invalidations, d.invalidations) as invalidations, COALESCE(ac.invalidations_delta, d.invalidations_delta) as invalidations_delta, COALESCE(ac.parse_calls, d.parse_calls) as parse_calls,
	COALESCE(ac.disk_reads, d.disk_reads) as disk_reads, COALESCE(ac.disk_reads_delta, d.disk_reads_delta) as disk_reads_delta, COALESCE(ac.buffer_gets, d.buffer_gets) as buffer_gets, COALESCE(ac.buffer_gets_delta, d.buffer_gets_delta) as buffer_gets_delta,
	COALESCE(ac.rows_processed, d.rows_processed) as rows_processed, COALESCE(ac.rows_processed_delta, d.rows_processed_delta) as rows_processed_delta, COALESCE(ac.user_io_wait_time, d.user_io_wait_time) as user_io_wait_time, COALESCE(ac.user_io_wait_time_delta, d.user_io_wait_time_delta) as user_io_wait_time_delta,
	COALESCE(ac.cluster_wait_time, d.cluster_wait_time) as cluster_wait_time, COALESCE(ac.cluster_wait_time_delta, d.cluster_wait_time_delta) as cluster_wait_time_delta, COALESCE(ac.application_wait_time, d.application_wait_time) as application_wait_time, COALESCE(ac.application_wait_time_delta, d.application_wait_time_delta) as application_wait_time_delta,
	COALESCE(ac.concurrency_wait_time, d.concurrency_wait_time) as concurrency_wait_time, COALESCE(ac.concurrency_wait_time_delta, d.concurrency_wait_time_delta) as concurrency_wait_time_delta, COALESCE(ac.direct_writes, d.direct_writes) as direct_writes, COALESCE(ac.direct_writes_delta, d.direct_writes_delta) as direct_writes_delta,
	COALESCE(ac.plsql_exec_time, d.plsql_exec_time) as plsql_exec_time, COALESCE(ac.plsql_exec_time_delta, d.plsql_exec_time_delta) as plsql_exec_time_delta, COALESCE(ac.bind_data, d.bind_data) as bind_data, COALESCE(ac.parsing_user_id, d.parsing_user_id) as parsing_user_id,
	COALESCE(ac.io_interconnect_bytes, d.io_interconnect_bytes) as io_interconnect_bytes, COALESCE(ac.io_interconnect_bytes_delta, d.io_interconnect_bytes_delta) as io_interconnect_bytes_delta, COALESCE(ac.physical_read_requests, d.physical_read_requests) as physical_read_requests, COALESCE(ac.physical_read_requests_delta, d.physical_read_requests_delta) as physical_read_requests_delta,
	COALESCE(ac.physical_read_bytes, d.physical_read_bytes) as physical_read_bytes, COALESCE(ac.physical_read_bytes_delta, d.physical_read_bytes_delta) as physical_read_bytes_delta, COALESCE(ac.physical_write_requests, d.physical_write_requests) as physical_write_requests, COALESCE(ac.physical_write_requests_delta, d.physical_write_requests_delta) as physical_write_requests_delta,
	COALESCE(ac.physical_write_bytes, d.physical_write_bytes) as physical_write_bytes, COALESCE(ac.physical_write_bytes_delta, d.physical_write_bytes_delta) as physical_write_bytes_delta
from (
  select COALESCE(ab.sql_id, c.sql_id) as sql_id, COALESCE(ab.first_load_location, c.first_load_location) as first_load_location, COALESCE(ab.elapsed_time_delta, c.elapsed_time_delta) as elapsed_time_delta, COALESCE(ab.cpu_time_delta, c.cpu_time_delta) as cpu_time_delta,
	COALESCE(ab.parse_calls_delta, c.parse_calls_delta) as parse_calls_delta, COALESCE(ab.sharable_mem, c.sharable_mem) as sharable_mem, COALESCE(ab.plan_hash_value, c.plan_hash_value) as plan_hash_value, COALESCE(ab.optimizer_cost, c.optimizer_cost) as optimizer_cost,
	COALESCE(ab.optimizer_mode, c.optimizer_mode) as optimizer_mode, COALESCE(ab.optimizer_env_hash_value, c.optimizer_env_hash_value) as optimizer_env_hash_value, COALESCE(ab.loaded_versions, c.loaded_versions) as loaded_versions, COALESCE(ab.version_count, c.version_count) as version_count,
	COALESCE(ab.module, c.module) as module, COALESCE(ab.action, c.action) as action, COALESCE(ab.parsing_schema_id, c.parsing_schema_id) as parsing_schema_id, COALESCE(ab.parsing_schema_name, c.parsing_schema_name) as parsing_schema_name,
	COALESCE(ab.fetches, c.fetches) as fetches, COALESCE(ab.fetches_delta, c.fetches_delta) as fetches_delta, COALESCE(ab.end_of_fetch_count, c.end_of_fetch_count) as end_of_fetch_count, COALESCE(ab.end_of_fetch_count_delta, c.end_of_fetch_count_delta) as end_of_fetch_count_delta,
	COALESCE(ab.sorts, c.sorts) as sorts, COALESCE(ab.sorts_delta, c.sorts_delta) as sorts_delta, COALESCE(ab.executions, c.executions) as executions, COALESCE(ab.executions_delta, c.executions_delta) as executions_delta,
	COALESCE(ab.px_servers_executions, c.px_servers_executions) as px_servers_executions, COALESCE(ab.px_servers_executions_delta, c.px_servers_executions_delta) as px_servers_executions_delta, COALESCE(ab.loads, c.loads) as loads, COALESCE(ab.loads_delta, c.loads_delta) as loads_delta,
	COALESCE(ab.invalidations, c.invalidations) as invalidations, COALESCE(ab.invalidations_delta, c.invalidations_delta) as invalidations_delta, COALESCE(ab.parse_calls, c.parse_calls) as parse_calls, 
	COALESCE(ab.disk_reads, c.disk_reads) as disk_reads, COALESCE(ab.disk_reads_delta, c.disk_reads_delta) as disk_reads_delta, COALESCE(ab.buffer_gets, c.buffer_gets) as buffer_gets, COALESCE(ab.buffer_gets_delta, c.buffer_gets_delta) as buffer_gets_delta,
	COALESCE(ab.rows_processed, c.rows_processed) as rows_processed, COALESCE(ab.rows_processed_delta, c.rows_processed_delta) as rows_processed_delta, COALESCE(ab.user_io_wait_time, c.user_io_wait_time) as user_io_wait_time, COALESCE(ab.user_io_wait_time_delta, c.user_io_wait_time_delta) as user_io_wait_time_delta,
	COALESCE(ab.cluster_wait_time, c.cluster_wait_time) as cluster_wait_time, COALESCE(ab.cluster_wait_time_delta, c.cluster_wait_time_delta) as cluster_wait_time_delta, COALESCE(ab.application_wait_time, c.application_wait_time) as application_wait_time, COALESCE(ab.application_wait_time_delta, c.application_wait_time_delta) as application_wait_time_delta,
	COALESCE(ab.concurrency_wait_time, c.concurrency_wait_time) as concurrency_wait_time, COALESCE(ab.concurrency_wait_time_delta, c.concurrency_wait_time_delta) as concurrency_wait_time_delta, COALESCE(ab.direct_writes, c.direct_writes) as direct_writes, COALESCE(ab.direct_writes_delta, c.direct_writes_delta) as direct_writes_delta,
	COALESCE(ab.plsql_exec_time, c.plsql_exec_time) as plsql_exec_time, COALESCE(ab.plsql_exec_time_delta, c.plsql_exec_time_delta) as plsql_exec_time_delta, COALESCE(ab.bind_data, c.bind_data) as bind_data, COALESCE(ab.parsing_user_id, c.parsing_user_id) as parsing_user_id,
	COALESCE(ab.io_interconnect_bytes, c.io_interconnect_bytes) as io_interconnect_bytes, COALESCE(ab.io_interconnect_bytes_delta, c.io_interconnect_bytes_delta) as io_interconnect_bytes_delta, COALESCE(ab.physical_read_requests, c.physical_read_requests) as physical_read_requests, COALESCE(ab.physical_read_requests_delta, c.physical_read_requests_delta) as physical_read_requests_delta,
	COALESCE(ab.physical_read_bytes, c.physical_read_bytes) as physical_read_bytes, COALESCE(ab.physical_read_bytes_delta, c.physical_read_bytes_delta) as physical_read_bytes_delta, COALESCE(ab.physical_write_requests, c.physical_write_requests) as physical_write_requests, COALESCE(ab.physical_write_requests_delta, c.physical_write_requests_delta) as physical_write_requests_delta,
	COALESCE(ab.physical_write_bytes, c.physical_write_bytes) as physical_write_bytes, COALESCE(ab.physical_write_bytes_delta, c.physical_write_bytes_delta) as physical_write_bytes_delta
  from (
    select COALESCE(a.sql_id, b.sql_id) as sql_id, COALESCE(a.first_load_location, b.first_load_location) as first_load_location, COALESCE(a.elapsed_time_delta, b.elapsed_time_delta) as elapsed_time_delta, COALESCE(a.cpu_time_delta, b.cpu_time_delta) as cpu_time_delta,
	  COALESCE(a.parse_calls_delta, b.parse_calls_delta) as parse_calls_delta, COALESCE(a.sharable_mem, b.sharable_mem) as sharable_mem, COALESCE(a.plan_hash_value, b.plan_hash_value) as plan_hash_value, COALESCE(a.optimizer_cost, b.optimizer_cost) as optimizer_cost,
	  COALESCE(a.optimizer_mode, b.optimizer_mode) as optimizer_mode, COALESCE(a.optimizer_env_hash_value, b.optimizer_env_hash_value) as optimizer_env_hash_value, COALESCE(a.loaded_versions, b.loaded_versions) as loaded_versions, COALESCE(a.version_count, b.version_count) as version_count,
	  COALESCE(a.module, b.module) as module, COALESCE(a.action, b.action) as action, COALESCE(a.parsing_schema_id, b.parsing_schema_id) as parsing_schema_id, COALESCE(a.parsing_schema_name, b.parsing_schema_name) as parsing_schema_name,
	  COALESCE(a.fetches, b.fetches) as fetches, COALESCE(a.fetches_delta, b.fetches_delta) as fetches_delta, COALESCE(a.end_of_fetch_count, b.end_of_fetch_count) as end_of_fetch_count, COALESCE(a.end_of_fetch_count_delta, b.end_of_fetch_count_delta) as end_of_fetch_count_delta,
	  COALESCE(a.sorts, b.sorts) as sorts, COALESCE(a.sorts_delta, b.sorts_delta) as sorts_delta, COALESCE(a.executions, b.executions) as executions, COALESCE(a.executions_delta, b.executions_delta) as executions_delta,
	  COALESCE(a.px_servers_executions, b.px_servers_executions) as px_servers_executions, COALESCE(a.px_servers_executions_delta, b.px_servers_executions_delta) as px_servers_executions_delta, COALESCE(a.loads, b.loads) as loads, COALESCE(a.loads_delta, b.loads_delta) as loads_delta,
	  COALESCE(a.invalidations, b.invalidations) as invalidations, COALESCE(a.invalidations_delta, b.invalidations_delta) as invalidations_delta, COALESCE(a.parse_calls, b.parse_calls) as parse_calls, 
	  COALESCE(a.disk_reads, b.disk_reads) as disk_reads, COALESCE(a.disk_reads_delta, b.disk_reads_delta) as disk_reads_delta, COALESCE(a.buffer_gets, b.buffer_gets) as buffer_gets, COALESCE(a.buffer_gets_delta, b.buffer_gets_delta) as buffer_gets_delta,
	  COALESCE(a.rows_processed, b.rows_processed) as rows_processed, COALESCE(a.rows_processed_delta, b.rows_processed_delta) as rows_processed_delta, COALESCE(a.user_io_wait_time, b.user_io_wait_time) as user_io_wait_time, COALESCE(a.user_io_wait_time_delta, b.user_io_wait_time_delta) as user_io_wait_time_delta,
	  COALESCE(a.cluster_wait_time, b.cluster_wait_time) as cluster_wait_time, COALESCE(a.cluster_wait_time_delta, b.cluster_wait_time_delta) as cluster_wait_time_delta, COALESCE(a.application_wait_time, b.application_wait_time) as application_wait_time, COALESCE(a.application_wait_time_delta, b.application_wait_time_delta) as application_wait_time_delta,
	  COALESCE(a.concurrency_wait_time, b.concurrency_wait_time) as concurrency_wait_time, COALESCE(a.concurrency_wait_time_delta, b.concurrency_wait_time_delta) as concurrency_wait_time_delta, COALESCE(a.direct_writes, b.direct_writes) as direct_writes, COALESCE(a.direct_writes_delta, b.direct_writes_delta) as direct_writes_delta,
	  COALESCE(a.plsql_exec_time, b.plsql_exec_time) as plsql_exec_time, COALESCE(a.plsql_exec_time_delta, b.plsql_exec_time_delta) as plsql_exec_time_delta, COALESCE(a.bind_data, b.bind_data) as bind_data, COALESCE(a.parsing_user_id, b.parsing_user_id) as parsing_user_id,
	  COALESCE(a.io_interconnect_bytes, b.io_interconnect_bytes) as io_interconnect_bytes, COALESCE(a.io_interconnect_bytes_delta, b.io_interconnect_bytes_delta) as io_interconnect_bytes_delta, COALESCE(a.physical_read_requests, b.physical_read_requests) as physical_read_requests, COALESCE(a.physical_read_requests_delta, b.physical_read_requests_delta) as physical_read_requests_delta,
	  COALESCE(a.physical_read_bytes, b.physical_read_bytes) as physical_read_bytes, COALESCE(a.physical_read_bytes_delta, b.physical_read_bytes_delta) as physical_read_bytes_delta, COALESCE(a.physical_write_requests, b.physical_write_requests) as physical_write_requests, COALESCE(a.physical_write_requests_delta, b.physical_write_requests_delta) as physical_write_requests_delta,
	  COALESCE(a.physical_write_bytes, b.physical_write_bytes) as physical_write_bytes, COALESCE(a.physical_write_bytes_delta, b.physical_write_bytes_delta) as physical_write_bytes_delta	
	from (select * from ranked_sql order by elapsed_time_delta desc limit 30) a
    full join (SELECT * FROM ranked_sql order by cpu_time_delta desc limit 30) b on a.sql_id = b.sql_id and a.first_load_location = b.first_load_location
  ) ab 
  full join (SELECT * FROM ranked_sql order by parse_calls_delta desc limit 30) c on c.sql_id = ab.sql_id and c.first_load_location = ab.first_load_location
)ac
full join (SELECT * FROM ranked_sql order by sharable_mem desc limit 30) d on ac.sql_id = d.sql_id and ac.first_load_location = d.first_load_location;
```

计划：

![WXWorkLocalPro_17361454308468.png](https://pingcode.yasdb.com/atlas/files/public/677b858ca1ad9a3311de60c0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBZ0NBQUFBQUJFQUFBQUJBQVFBQUFBQUFBQUFJQUFBQUFBQUFBQUFnQUFBQUFBQUFJQUFBQUFBQUFFQUFCQUFBRUFLQUFBQUFBQUFBQUlBQUFBQUFBQUFBQ1VFQkFFQUFBQUFBQUFBQUFBRUFBQUFBQUFBaEFBQVFBQUFBQWdBQUFCQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNDUyNjIsImV4cCI6MTc4MjM1NjA2Mn0.dMWKTk19YJ1ZquGQ3BuKIyGaDkCMKz49-TdRPLkkcdU)



### **性能测试数据：**

**1.默认vm 128M，20w的sql数据，取top 30：**

|增量变化sql数量|sql语法|平均耗时|第一次执行耗时|第二次执行耗时|第三次执行耗时|第四次执行耗时|第五次执行耗时|备注|
|---|---|---|---|---|---|---|---|---|
|1000|**1  (rownumber()）**|约1.1s|00:00:01.177|00:00:01.181|00:00:01.143|00:00:01.222|00:00:01.239||
||**2  (union)**|约4.4s|00:00:04.407|00:00:04.440|00:00:04.299|00:00:04.345|00:00:04.445||
||**3  (NESTED LOOPS FULL OUTER)**|约4.5s|00:00:04.542|00:00:04.524|00:00:04.542|00:00:04.476|00:00:04.510||
||**4  ( HASH JOIN FULL OUTER)**|约4.3s|00:00:04.358|00:00:04.336|00:00:04.333|00:00:04.369|00:00:04.275||
|1w|1|约1.5s|00:00:01.514|00:00:01.475|00:00:01.476|00:00:01.468|00:00:01.499||
||2|约4.8s|00:00:04.881|00:00:04.841|00:00:04.886|00:00:04.770|00:00:04.746||
||3|约5s|00:00:05.422|00:00:05.012|00:00:05.042|00:00:05.039|00:00:05.104||
||4|约4.4s|00:00:04.358|00:00:04.341|00:00:04.347|00:00:04.366|00:00:04.490||
|5w|1|约2.6s|00:00:02.674|00:00:02.607|00:00:02.683|00:00:02.714|00:00:02.642||
||2|约6.5s|00:00:06.449|00:00:06.572|00:00:06.543|00:00:06.688|00:00:06.394||
||3|约6.7s|00:00:06.760|00:00:06.779|00:00:06.704|00:00:06.786|00:00:06.782||
||4|约6.5s|00:00:06.457|00:00:06.564|00:00:06.641|00:00:06.575|00:00:06.479||
|20w|1|约7s|00:00:07.591|00:00:07.039|00:00:07.103|00:00:06.960|00:00:07.052||
||2|约12.8s|00:00:12.744|00:00:13.034|00:00:12.753|00:00:12.725|00:00:12.976||
||3|约12.8s|00:00:12.917|00:00:12.839|00:00:12.948|00:00:12.974|00:00:12.757||
||4|约12.4s| 00:00:12.680| 00:00:12.371|00:00:12.443|00:00:12.429|00:00:12.434||


**2.默认vm 128M，20w的sql数据，取top 5w：(yasql执行sql文件结果输出到文件）**

|增量变化sql数量|sql语法|平均耗时|第一次执行耗时|第二次执行耗时|第三次执行耗时|第四次执行耗时|第五次执行耗时|备注|
|---|---|---|---|---|---|---|---|---|
|20w|**1  (rownumber()）**|约17.4s|00:00:17.273|00:00:17.399|00:00:17.573||||
||**2  (union)**|约25.8s| 00:00:25.867|00:00:25.749|00:00:25.764||||
||**3  (NESTED LOOPS FULL OUTER)**|跑不动，几分钟没结果|||||||
||**4  ( HASH JOIN FULL OUTER)**|约27.7s| 00:00:28.222|00:00:27.684|00:00:27.496||||




**3.vm 64M，20w的sql数据，取top 30：**

|增量变化sql数量|sql语法|平均耗时|第一次执行耗时|第二次执行耗时|第三次执行耗时|第四次执行耗时|第五次执行耗时|备注|
|---|---|---|---|---|---|---|---|---|
|1000|**1  (rownumber()）**|约1.3s|00:00:01.244|00:00:01.172|00:00:01.442||||
||**2  (union)**|约4.4s|00:00:04.583|00:00:04.320|00:00:04.324||||
||**3  (NESTED LOOPS FULL OUTER)**|约4.5s|00:00:04.516|00:00:04.558|00:00:04.543||||
||**4  ( HASH JOIN FULL OUTER)**|约4.4s| 00:00:04.321| 00:00:04.613| 00:00:04.447||||
|1w|1|约1.5s| 00:00:01.537| 00:00:01.508| 00:00:01.462||||
||2|约4.8s| 00:00:04.765| 00:00:04.776| 00:00:04.866||||
||3|约5s| 00:00:05.056| 00:00:04.935| 00:00:04.940||||
||4|约4.8s|00:00:04.803|00:00:04.705|00:00:04.803||||
|5w|1|约2.6s|00:00:02.624| 00:00:02.663| 00:00:02.571||||
||2|约6.4s| 00:00:06.389| 00:00:06.519| 00:00:06.406||||
||3|约6.6s|00:00:06.541|00:00:06.618|00:00:06.621||||
||4|约6.3s|00:00:06.268|00:00:06.449|00:00:06.317||||
|20w|1|约10.4s|00:00:11.306| 00:00:10.653|00:00:10.263|00:00:10.237|00:00:10.205||
||2|约13.1s|00:00:13.091|00:00:13.084|00:00:13.100|00:00:13.018|00:00:13.053||
||3|约13.1s|00:00:13.038|00:00:13.061|00:00:13.203|00:00:13.199|00:00:13.107||
||4|约12.8s|00:00:12.952|00:00:12.656|00:00:12.972|00:00:12.920|00:00:12.654||


**4.vm 64M，20w的sql数据，取top 1w：**

|增量变化sql数量|sql语法|平均耗时|第一次执行耗时|第二次执行耗时|第三次执行耗时|第四次执行耗时|第五次执行耗时|备注|
|---|---|---|---|---|---|---|---|---|
|1000|**1  (rownumber()）**|约2.3s|00:00:02.390|00:00:02.272|00:00:02.380||||
||**2  (union)**|约5.5s|00:00:05.449|00:00:05.490|00:00:05.577||||
||**3  (NESTED LOOPS FULL OUTER)**|约15s|00:00:15.288|00:00:15.052|00:00:14.731||||
||**4  ( HASH JOIN FULL OUTER)**|约5.4s| 00:00:05.284| 00:00:05.477| 00:00:05.459||||
|1w|1|约12.7s|00:00:12.802|00:00:12.656|00:00:12.641||||
||2|约16.5s|00:00:16.541|00:00:16.533|00:00:16.445||||
||3|跑不动（几分钟跑不出结果）|||||||
||4|约14.8s| 00:00:14.804| 00:00:14.953| 00:00:14.779||||
|5w|1|约22.6s|00:00:22.714|00:00:22.573|00:00:22.572||||
||2|约27s|00:00:27.045|00:00:27.123|00:00:26.986||||
||3|跑不动|||||||
||4|约24.5s|00:00:24.607|00:00:24.367|00:00:24.406||||
|20w|1|约32.9s|00:00:32.951|00:00:32.933|00:00:32.864||||
||2|约36.4s| 00:00:36.765| 00:00:36.389| 00:00:36.327||||
||3|跑不动|||||||
||4|约33.6s|00:00:33.541|00:00:33.736|00:00:33.641||||


**5.vm 64M，20w的sql数据，取top 5w：**

|增量变化sql数量|sql语法|平均耗时|第一次执行耗时|第二次执行耗时|第三次执行耗时|第四次执行耗时|第五次执行耗时|备注|
|---|---|---|---|---|---|---|---|---|
|1000|**1  (rownumber()）**|约2.3s|00:00:02.253|00:00:02.271|00:00:02.252||||
||**2  (union)**|约5.5s| 00:00:05.505| 00:00:05.432| 00:00:05.433||||
||**3  (NESTED LOOPS FULL OUTER)**|约14.9s| 00:00:14.740| 00:00:15.009| 00:00:14.767||||
||**4  ( HASH JOIN FULL OUTER)**|约5.3s|00:00:05.276|00:00:05.350|00:00:05.414||||
|1w|1|约12.7s|00:00:12.691|00:00:12.673|00:00:12.678||||
||2|约16.6s|00:00:16.778|00:00:16.433|00:00:16.609||||
||3|跑不动|跑不动||||||
||4|约14.9s|00:00:15.024|00:00:14.845|00:00:14.839||||
|5w|1|约59.2s|00:00:59.360|00:00:59.165|||||
||2|约1分5秒|00:01:05.783|00:01:05.507|||||
||3|跑不动|跑不动||||||
||4|报错YAS-02025 no free space in virtual memory pool|||||||
|20w|1|约1分49秒|00:01:48.137| 00:01:50.690|||||
||2|约1分55秒|00:01:55.287|00:01:55.195|||||
||3|跑不动|跑不动||||||
||4|报错|报错||||||


**6.vm 32M，20w的sql数据，取top 30：**

|增量变化sql数量|sql语法|平均耗时|第一次执行耗时|第二次执行耗时|第三次执行耗时|第四次执行耗时|第五次执行耗时|备注|
|---|---|---|---|---|---|---|---|---|
|20w|**1  (rownumber()）**|约11s|00:00:11.834|00:00:10.677|00:00:10.658||||
||**2  (union)**|约13s|00:00:13.084|00:00:12.922|00:00:13.196||||
||**3  (NESTED LOOPS FULL OUTER)**|约13s|00:00:13.061|00:00:13.115|00:00:13.068||||
||**4  ( HASH JOIN FULL OUTER)**|约12.7s|00:00:12.649|00:00:12.692|00:00:12.672||||


**7.vm 16M，20w的sql数据，取top 30：**

|增量变化sql数量|sql语法|平均耗时|第一次执行耗时|第二次执行耗时|第三次执行耗时|第四次执行耗时|第五次执行耗时|备注|
|---|---|---|---|---|---|---|---|---|
|5w|**1  (rownumber()）**|约3.2s|00:00:03.301|00:00:03.113|00:00:03.214||||
||**2  (union)**|约6.6s| 00:00:06.516| 00:00:06.717| 00:00:06.570||||
||**3  (NESTED LOOPS FULL OUTER)**|约6.9s|00:00:06.864|00:00:06.914|00:00:06.913||||
||**4  ( HASH JOIN FULL OUTER)**|约6.5s|00:00:06.613|00:00:06.494|00:00:06.521||||
|20w|1|约10.2s|00:00:10.996|00:00:10.106|00:00:10.150||||
||2|约13s| 00:00:13.106| 00:00:12.884| 00:00:12.975||||
||3|约13s|00:00:13.066|00:00:13.110|00:00:12.939||||
||4|约12.6s|00:00:13.108|00:00:12.623|00:00:12.433||||


**8.vm 8M，20w的sql数据，取top 30：**

|增量变化sql数量|sql语法|平均耗时|第一次执行耗时|第二次执行耗时|第三次执行耗时|第四次执行耗时|第五次执行耗时|备注|
|---|---|---|---|---|---|---|---|---|
|5w|**1  (rownumber()）**|约3.1s|00:00:03.043|00:00:03.157|00:00:03.062||||
||**2  (union)**|约6.6s|00:00:06.533|00:00:06.621|00:00:06.664||||
||**3  (NESTED LOOPS FULL OUTER)**|约6.7s|00:00:06.690|00:00:06.845|00:00:06.745||||
||**4  ( HASH JOIN FULL OUTER)**|约6.5s|00:00:06.384|00:00:06.468|00:00:06.498||||
|20w|1|约11.2s|00:00:12.480|00:00:11.242|00:00:11.169||||
||2|约12.7s|00:00:12.602|00:00:12.873|00:00:12.713||||
||3|约13s|00:00:13.077|00:00:12.983|00:00:13.206||||
||4|约12.4s|00:00:12.576|00:00:12.451|00:00:12.387||||


**9.vm 8M，40w的sql数据，取top 30：**

|增量变化sql数量|sql语法|平均耗时|第一次执行耗时|第二次执行耗时|第三次执行耗时|第四次执行耗时|第五次执行耗时|备注|
|---|---|---|---|---|---|---|---|---|
|5w|**1  (rownumber()）**|约4.3s|00:00:04.564|00:00:04.199|00:00:04.337||||
||**2  (union)**|约10.7s| 00:00:10.752| 00:00:10.597| 00:00:10.807||||
||**3  (NESTED LOOPS FULL OUTER)**|报错|报错||||||
||**4  ( HASH JOIN FULL OUTER)**|约10.7s|00:00:10.728|00:00:10.775|00:00:10.754||||
|40w|1|约20s（换出次数约为13w)|00:00:20.954|00:00:20.301|00:00:19.783||||
||2|约26s|00:00:26.415|00:00:25.968|00:00:26.152||||
||3|报错|报错||||||
||4|约25.8s(换出次数约为1w)|00:00:25.753|00:00:25.863|00:00:25.745||||


![WXWorkLocalPro_17363000575706.png](https://pingcode.yasdb.com/atlas/files/public/677dd641a1ad9a3311de629b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBZ0NBQUFBQUJFQUFBQUJBQVFBQUFBQUFBQUFJQUFBQUFBQUFBQUFnQUFBQUFBQUFJQUFBQUFBQUFFQUFCQUFBRUFLQUFBQUFBQUFBQUlBQUFBQUFBQUFBQ1VFQkFFQUFBQUFBQUFBQUFBRUFBQUFBQUFBaEFBQVFBQUFBQWdBQUFCQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNDUyNjIsImV4cCI6MTc4MjM1NjA2Mn0.dMWKTk19YJ1ZquGQ3BuKIyGaDkCMKz49-TdRPLkkcdU)

![WXWorkLocalPro_17363000575706.png](https://pingcode.yasdb.com/atlas/files/public/677dd64aa1ad9a3311de629c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBZ0NBQUFBQUJFQUFBQUJBQVFBQUFBQUFBQUFJQUFBQUFBQUFBQUFnQUFBQUFBQUFJQUFBQUFBQUFFQUFCQUFBRUFLQUFBQUFBQUFBQUlBQUFBQUFBQUFBQ1VFQkFFQUFBQUFBQUFBQUFBRUFBQUFBQUFBaEFBQVFBQUFBQWdBQUFCQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNDUyNjIsImV4cCI6MTc4MjM1NjA2Mn0.dMWKTk19YJ1ZquGQ3BuKIyGaDkCMKz49-TdRPLkkcdU)

总结：

20w、40w的sql数据下，对于rownumber()、union、NESTED LOOPS FULL OUTER、HASH JOIN FULL OUTER四个sql语法，任意有增量变化的sql数量、vm大小、top值，rownumber()的性能均为最优，尤其5w以下的增量变化sql时，任意vm下rownumber()的性能都明显优于其他sql语法；HASH JOIN FULL OUTER总体表现下仅次于rownumber()，但在vm 64M、20w的sql数量和有增量变化sql数量、取top5w时，会报vm空间不足。