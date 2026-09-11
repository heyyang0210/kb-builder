### oceanbase:

**1.sql统计信息来源__all_virtual_sqlstat虚拟表，表字段包含各类统计项的_total和_delta：**

（virtual_table 目录下是 sys 租户各个 __all_virtual 虚拟表的实现，“虚拟表”其实是 一种view，它把一些内存数据结构抽象成表接口暴露出来，用于诊断调试等，是把内存数据结构映射成可以用 SQL 语句直接查询的“表”。和我们的x$表本质一样）

![WXWorkLocalPro_17346880366501.png](https://pingcode.yasdb.com/atlas/files/public/67653d5da1ad9a3311de52f5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQVlBQUFBQUFBQWdBQUFBQUFBQUFBQUNBQUFBQ0FBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFFQUFFQVFBQUFBQUFBQUFBQUFBQUFBRUFBQUFVQUFBQUFBQUFBQUFBQUNBQUFBQUFBQWdBQUFBQUFBQUFCQVlBQUFBQUFBQUlBQUFBQUFBUUlBQUFnQUFBQUlBQUFBQUFBQUFBZ0FBUUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNDUyNDEsImV4cCI6MTc4MjM1NjA0MX0.Nxp1iuNMp4oXdE__bisreAJmaTsCIBnENAB1awp3Ywk)



**2.sql统计信息保存在ObPlanCache->ObLCObjectManager co_mgr_ -> ObHashMap<ObCacheObjID, ObILibCacheObject*> IdCacheObjectMap => ObSqlStatRecordObj->record_value_（ObExecutedSqlStatRecord）;**

**ObExecutedSqlStatRecord记录了各类统计项的_total和_last_snap。**

**3.创建快照时，对__all_virtual_sqlstat表正常查询，在成功插入到__wr_sqlstat系统表后统一更新sqlstat，也即更新ObExecutedSqlStatRecord的_last_snap:**

![WXWorkLocalPro_17349254021479.png](https://pingcode.yasdb.com/atlas/files/public/6768e090a1ad9a3311de5459/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQVlBQUFBQUFBQWdBQUFBQUFBQUFBQUNBQUFBQ0FBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFFQUFFQVFBQUFBQUFBQUFBQUFBQUFBRUFBQUFVQUFBQUFBQUFBQUFBQUNBQUFBQUFBQWdBQUFBQUFBQUFCQVlBQUFBQUFBQUlBQUFBQUFBUUlBQUFnQUFBQUlBQUFBQUFBQUFBZ0FBUUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNDUyNDEsImV4cCI6MTc4MjM1NjA0MX0.Nxp1iuNMp4oXdE__bisreAJmaTsCIBnENAB1awp3Ywk)

![WXWorkLocalPro_17349256929359.png](https://pingcode.yasdb.com/atlas/files/public/6768e0a0a1ad9a3311de545a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQVlBQUFBQUFBQWdBQUFBQUFBQUFBQUNBQUFBQ0FBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFFQUFFQVFBQUFBQUFBQUFBQUFBQUFBRUFBQUFVQUFBQUFBQUFBQUFBQUNBQUFBQUFBQWdBQUFBQUFBQUFCQVlBQUFBQUFBQUlBQUFBQUFBUUlBQUFnQUFBQUlBQUFBQUFBQUFBZ0FBUUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNDUyNDEsImV4cCI6MTc4MjM1NjA0MX0.Nxp1iuNMp4oXdE__bisreAJmaTsCIBnENAB1awp3Ywk)

![WXWorkLocalPro_17349257994465.png](https://pingcode.yasdb.com/atlas/files/public/6768e0aaa1ad9a3311de545b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQVlBQUFBQUFBQWdBQUFBQUFBQUFBQUNBQUFBQ0FBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFFQUFFQVFBQUFBQUFBQUFBQUFBQUFBRUFBQUFVQUFBQUFBQUFBQUFBQUNBQUFBQUFBQWdBQUFBQUFBQUFCQVlBQUFBQUFBQUlBQUFBQUFBUUlBQUFnQUFBQUlBQUFBQUFBQUFBZ0FBUUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNDUyNDEsImV4cCI6MTc4MjM1NjA0MX0.Nxp1iuNMp4oXdE__bisreAJmaTsCIBnENAB1awp3Ywk)

![WXWorkLocalPro_17349266845706.png](https://pingcode.yasdb.com/atlas/files/public/6768e171a1ad9a3311de545d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQVlBQUFBQUFBQWdBQUFBQUFBQUFBQUNBQUFBQ0FBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFFQUFFQVFBQUFBQUFBQUFBQUFBQUFBRUFBQUFVQUFBQUFBQUFBQUFBQUNBQUFBQUFBQWdBQUFBQUFBQUFCQVlBQUFBQUFBQUlBQUFBQUFBUUlBQUFnQUFBQUlBQUFBQUFBQUFBZ0FBUUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNDUyNDEsImV4cCI6MTc4MjM1NjA0MX0.Nxp1iuNMp4oXdE__bisreAJmaTsCIBnENAB1awp3Ywk)

**4.并发控制：**

**创建快照时更新sqlstat：**  遍历hashMap，加读锁，禁止其他更新操作；

**查询__all_virtual_sqlstat：**  通过atomic操作获取ObILibCacheObject并且对ObILibCacheObject的ref_count加1；获取到ObILibCacheObject之后copy到ObExecutedSqlStatRecord；

**sql执行完更新sqlstat：**  获取ObILibCacheObject时加读锁。



**5.数据一致性：**

oracle和oceanbase都是执行完一条sql就提交，如果创建快照过程中被打断，则已提交的数据回滚不了，本次快照无法保证所有系统表都有收集到数据。



### postgres:

postgres的AWR功能通过安装组件pg_profile实现，  **对于sql相关统计信息的收集和我们类似，都是通过plsql实现，收集时收集全量的sql统计信息**  ，但有不同：

每次收集时全量数据存储在last_stat_statements表，同时每次收集时还会把和上一次的差值统计在sample_statements_total表，生成报告时直接从sample_statements_total表获取差值并取top sql。

**收集完统计信息之后，last_stat_statements表之前的数据即清空，只保留本次快照的结果。**

```
--last_stat_statements
INSERT INTO last_stat_statements (
        server_id,
        sample_id,
        userid,
        username,
        datid,
        queryid,
        plans,
        total_plan_time,
        min_plan_time,
        max_plan_time,
        mean_plan_time,
        stddev_plan_time,
        calls,
        total_exec_time,
        min_exec_time,
        max_exec_time,
        mean_exec_time,
        stddev_exec_time,
        rows,
        shared_blks_hit,
        shared_blks_read,
        shared_blks_dirtied,
        shared_blks_written,
        local_blks_hit,
        local_blks_read,
        local_blks_dirtied,
        local_blks_written,
        temp_blks_read,
        temp_blks_written,
        shared_blk_read_time,
        shared_blk_write_time,
        wal_records,
        wal_fpi,
        wal_bytes,
        toplevel,
        in_sample,
        jit_functions,
        jit_generation_time,
        jit_inlining_count,
        jit_inlining_time,
        jit_optimization_count,
        jit_optimization_time,
        jit_emission_count,
        jit_emission_time,
        temp_blk_read_time,
        temp_blk_write_time,
        local_blk_read_time,
        local_blk_write_time,
        jit_deform_count,
        jit_deform_time,
        stats_since,
        minmax_stats_since
      )
    SELECT
      sserver_id,
      s_id,
      dbl.userid,
      dbl.username,
      dbl.datid,
      dbl.queryid,
      dbl.plans,
      dbl.total_plan_time,
      dbl.min_plan_time,
      dbl.max_plan_time,
      dbl.mean_plan_time,
      dbl.stddev_plan_time,
      dbl.calls,
      dbl.total_exec_time,
      dbl.min_exec_time,
      dbl.max_exec_time,
      dbl.mean_exec_time,
      dbl.stddev_exec_time,
      dbl.rows,
      dbl.shared_blks_hit,
      dbl.shared_blks_read,
      dbl.shared_blks_dirtied,
      dbl.shared_blks_written,
      dbl.local_blks_hit,
      dbl.local_blks_read,
      dbl.local_blks_dirtied,
      dbl.local_blks_written,
      dbl.temp_blks_read,
      dbl.temp_blks_written,
      dbl.shared_blk_read_time,
      dbl.shared_blk_write_time,
      dbl.wal_records,
      dbl.wal_fpi,
      dbl.wal_bytes,
      dbl.toplevel,
      false,
      dbl.jit_functions,
      dbl.jit_generation_time,
      dbl.jit_inlining_count,
      dbl.jit_inlining_time,
      dbl.jit_optimization_count,
      dbl.jit_optimization_time,
      dbl.jit_emission_count,
      dbl.jit_emission_time,
      dbl.temp_blk_read_time,
      dbl.temp_blk_write_time,
      dbl.local_blk_read_time,
      dbl.local_blk_write_time,
      dbl.jit_deform_count,
      dbl.jit_deform_time,
      dbl.stats_since,
      dbl.minmax_stats_since
    FROM dblink('server_connection',st_query)
    AS dbl (
      -- pg_stat_statements fields
        userid              oid,
        username            name,
        datid               oid,
        queryid             bigint,
        toplevel            boolean,
        plans               bigint,
        total_plan_time     double precision,
        min_plan_time       double precision,
        max_plan_time       double precision,
        mean_plan_time      double precision,
        stddev_plan_time    double precision,
        calls               bigint,
        total_exec_time     double precision,
        min_exec_time       double precision,
        max_exec_time       double precision,
        mean_exec_time      double precision,
        stddev_exec_time    double precision,
        rows                bigint,
        shared_blks_hit     bigint,
        shared_blks_read    bigint,
        shared_blks_dirtied bigint,
        shared_blks_written bigint,
        local_blks_hit      bigint,
        local_blks_read     bigint,
        local_blks_dirtied  bigint,
        local_blks_written  bigint,
        temp_blks_read      bigint,
        temp_blks_written   bigint,
        shared_blk_read_time  double precision,
        shared_blk_write_time double precision,
        wal_records         bigint,
        wal_fpi             bigint,
        wal_bytes           numeric,
        jit_functions       bigint,
        jit_generation_time double precision,
        jit_inlining_count  bigint,
        jit_inlining_time   double precision,
        jit_optimization_count  bigint,
        jit_optimization_time   double precision,
        jit_emission_count  bigint,
        jit_emission_time   double precision,
        temp_blk_read_time  double precision,
        temp_blk_write_time double precision,
        local_blk_read_time double precision,
        local_blk_write_time  double precision,
        jit_deform_count    bigint,
        jit_deform_time     double precision,
        stats_since         timestamp with time zone,
        minmax_stats_since  timestamp with time zone
      );
      
--sample_statements_total
INSERT INTO sample_statements_total(
    server_id,
    sample_id,
    datid,
    plans,
    total_plan_time,
    calls,
    total_exec_time,
    rows,
    shared_blks_hit,
    shared_blks_read,
    shared_blks_dirtied,
    shared_blks_written,
    local_blks_hit,
    local_blks_read,
    local_blks_dirtied,
    local_blks_written,
    temp_blks_read,
    temp_blks_written,
    shared_blk_read_time,
    shared_blk_write_time,
    wal_records,
    wal_fpi,
    wal_bytes,
    statements,
    jit_functions,
    jit_generation_time,
    jit_inlining_count,
    jit_inlining_time,
    jit_optimization_count,
    jit_optimization_time,
    jit_emission_count,
    jit_emission_time,
    temp_blk_read_time,
    temp_blk_write_time,
    mean_max_plan_time,
    mean_max_exec_time,
    mean_min_plan_time,
    mean_min_exec_time,
    local_blk_read_time,
    local_blk_write_time,
    jit_deform_count,
    jit_deform_time
  )
  SELECT
    cur.server_id,
    s_id,
    cur.datid,
    sum(cur.plans - COALESCE(lst.plans, 0)),
    sum(cur.total_plan_time - COALESCE(lst.total_plan_time, 0.0)),
    sum(cur.calls - COALESCE(lst.calls, 0)),
    sum(cur.total_exec_time - COALESCE(lst.total_exec_time, 0.0)),
    sum(cur.rows - COALESCE(lst.rows, 0)),
    sum(cur.shared_blks_hit - COALESCE(lst.shared_blks_hit, 0)),
    sum(cur.shared_blks_read - COALESCE(lst.shared_blks_read, 0)),
    sum(cur.shared_blks_dirtied - COALESCE(lst.shared_blks_dirtied, 0)),
    sum(cur.shared_blks_written - COALESCE(lst.shared_blks_written, 0)),
    sum(cur.local_blks_hit - COALESCE(lst.local_blks_hit, 0)),
    sum(cur.local_blks_read - COALESCE(lst.local_blks_read, 0)),
    sum(cur.local_blks_dirtied - COALESCE(lst.local_blks_dirtied, 0)),
    sum(cur.local_blks_written - COALESCE(lst.local_blks_written, 0)),
    sum(cur.temp_blks_read - COALESCE(lst.temp_blks_read, 0)),
    sum(cur.temp_blks_written - COALESCE(lst.temp_blks_written, 0)),
    sum(cur.shared_blk_read_time - COALESCE(lst.shared_blk_read_time, 0)),
    sum(cur.shared_blk_write_time - COALESCE(lst.shared_blk_write_time, 0)),
    sum(cur.wal_records - COALESCE(lst.wal_records, 0)),
    sum(cur.wal_fpi - COALESCE(lst.wal_fpi, 0)),
    sum(cur.wal_bytes - COALESCE(lst.wal_bytes, 0)),
    count(nullif(cur.calls - COALESCE(lst.calls, 0), 0)),
    sum(cur.jit_functions - COALESCE(lst.jit_functions, 0)),
    sum(cur.jit_generation_time - COALESCE(lst.jit_generation_time, 0)),
    sum(cur.jit_inlining_count - COALESCE(lst.jit_inlining_count, 0)),
    sum(cur.jit_inlining_time - COALESCE(lst.jit_inlining_time, 0)),
    sum(cur.jit_optimization_count - COALESCE(lst.jit_optimization_count, 0)),
    sum(cur.jit_optimization_time - COALESCE(lst.jit_optimization_time, 0)),
    sum(cur.jit_emission_count - COALESCE(lst.jit_emission_count, 0)),
    sum(cur.jit_emission_time - COALESCE(lst.jit_emission_time, 0)),
    sum(cur.temp_blk_read_time - COALESCE(lst.temp_blk_read_time, 0)),
    sum(cur.temp_blk_write_time - COALESCE(lst.temp_blk_write_time, 0)),
    avg(cur.max_plan_time)::double precision,
    avg(cur.max_exec_time)::double precision,
    avg(cur.min_plan_time)::double precision,
    avg(cur.min_exec_time)::double precision,
    sum(cur.local_blk_read_time - COALESCE(lst.local_blk_read_time, 0)),
    sum(cur.local_blk_write_time - COALESCE(lst.local_blk_write_time, 0)),
    sum(cur.jit_deform_count - COALESCE(lst.jit_deform_count, 0)),
    sum(cur.jit_deform_time - COALESCE(lst.jit_deform_time, 0))
  FROM
    last_stat_statements cur
    -- In case of already dropped database
    JOIN sample_stat_database ssd USING (server_id, sample_id, datid)
    LEFT JOIN last_stat_statements lst ON
      (cur.server_id, lst.server_id, cur.sample_id, lst.sample_id, cur.datid,
      cur.userid, cur.queryid, cur.toplevel) =
      (sserver_id, sserver_id, s_id, s_id - 1, lst.datid,
      lst.userid, lst.queryid, lst.toplevel) AND
      (cur.stats_since = lst.stats_since OR (
          (NOT statements_reset) AND
          cur.calls >= lst.calls
        )
      )
  WHERE
    (cur.server_id, cur.sample_id) = (sserver_id, s_id)
  GROUP BY
    cur.server_id,
    cur.sample_id,
    cur.datid
  ;
  
--AWR
         SELECT
            COALESCE(sum(total_plan_time), 0.0) + sum(total_exec_time) AS total_time,
            sum(shared_blk_read_time) AS shared_blk_read_time,
            sum(shared_blk_write_time) AS shared_blk_write_time,
            sum(local_blk_read_time) AS local_blk_read_time,
            sum(local_blk_write_time) AS local_blk_write_time,
            sum(shared_blks_hit) AS shared_blks_hit,
            sum(shared_blks_read) AS shared_blks_read,
            sum(shared_blks_dirtied) AS shared_blks_dirtied,
            sum(temp_blks_read) AS temp_blks_read,
            sum(temp_blks_written) AS temp_blks_written,
            sum(temp_blk_read_time) AS temp_blk_read_time,
            sum(temp_blk_write_time) AS temp_blk_write_time,
            sum(local_blks_read) AS local_blks_read,
            sum(local_blks_written) AS local_blks_written,
            sum(calls) AS calls,
            sum(plans) AS plans
        FROM sample_statements_total st
        WHERE st.server_id = sserver_id AND st.sample_id BETWEEN start_id + 1 AND end_id;
        
      SELECT *
          FROM top_statements_format(sserver_id, start1_id, end1_id)
          WHERE least(
              ord_total_time,
              ord_plan_time,
              ord_exec_time,
              ord_calls,
              ord_io_time,
              ord_shared_blocks_fetched,
              ord_shared_blocks_read,
              ord_shared_blocks_dirt,
              ord_shared_blocks_written,
              ord_wal,
              ord_temp,
              ord_jit
            ) <= (report_context #>> '{report_properties,topn}'
```



