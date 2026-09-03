Created by 李浩勇, last modified on 十一月 15, 2024

# **1. 概述**

本文描述FORALL INSERT支持批量插入的测试设计

SR链接：  [https://pingcode.yasdb.com/wiki/spaces/XUYANG/pages/6739e15b728206efb9316504](https://pingcode.yasdb.com/wiki/spaces/XUYANG/pages/6739e15b728206efb9316504)    
  #YASHAN-3193 FORALL INSERT支持批量插入

# **2. 需求分析**

## 2.1 功能点分析

1. 在语法支持时支持批量插入，达到性能优化


# 3.   **详细测试设计**   

设计分析：

无新增删除功能，功能用例无需设计，复用历史 forall insert用例，只需设计性能用例。

测试点：

1、字段类型：

int, CLOB, BLOB, NCLOB, XMLTYPE, RAW(10), JSON, ROWID, UROWID, varchar(100),   object, table,     UDF(int)  , UDF(object),   exp(运算表达式), exp(拼接符), 长CLOB  , varchar(32000)，nvarchar(8000)，number(20,5), date

2、字段数量

单字段，多字段（1024）（100）

3、执行方式：

静态SQ  L，动态SQL

4、insert语句中是否包含变量

数组(i)

5、赋值方式

select 方式：select column,  select package.v(i)

子查询条数：1 条，多条

6、select 条件

带过滤条件，select 和 过滤条件中均包含数组元素

多重子查询

融选--

7、变量、数组位置

投影列，where 条件

8、覆盖单机、集群、分布式

9、数组类型

package.table  local.table  稀疏数组

10、其他

insert all



  


|g884010b39e||||yashan-优化前|yashan-优化后|oracle|yashan-优化前|yashan-优化后|
|---|---|---|---|---|---|---|---|---|
|　|序号|表字段类型|数据量|forall静态SQL-select|forall静态SQL-select|forall静态SQL-values|forall动态SQL-select|forall动态SQL-select|
|行存|1|int|200w|00:00:17.648|00:00:05.940|00:00:58.93|00:00:29.966|00:00:30.567|
||2|CLOB|200w|00:00:18.887|00:00:06.880|5min+|00:00:30.245|00:00:31.650|
||3|BLOB|200w|00:00:18.314|00:00:07.223|5min+|00:00:29.784|00:00:30.929|
||4|NCLOB|200w|00:00:18.147|00:00:07.058|00:00:31.54|00:00:30.221|00:00:30.835|
||5|XMLTYPE|200w|00:00:18.050|00:00:07.105|　|00:00:30.256|00:00:30.704|
||6|RAW(10)|200w|00:00:17.902|00:00:06.503|00:00:59.51|00:00:30.362|00:00:30.714|
||7|JSON|200w|00:00:19.370|00:00:06.831|　|00:00:30.029|00:00:30.626|
||8|ROWID|200w|00:00:17.576|00:00:06.112|　|00:00:29.034|00:00:29.940|
||9|UROWID|200w|00:00:17.701|00:00:06.548|　|00:00:30.545|00:00:30.579|
||10|varchar(100)|200w|00:00:17.905|00:00:06.657|00:00:47.95|00:00:29.779|00:00:30.386|
||11|nvarchar(8000)|20w|00:00:30.880|00:00:31.667|00:00:58.07|00:00:17.866|00:00:15.073|
||12|varchar(32000)|2w|00:00:05.644|00:00:05.819|00:01:45.67|00:00:05.579|00:00:05.064|
||13|UDF(int)|200w|00:00:29.132|00:00:14.749|00:01:01.60|00:00:45.211|00:00:50.169|
||14|exp(运算表达式)|200w|00:00:20.274|00:00:10.923|00:01:01.22|00:00:34.782|00:00:36.546|
||15|exp(拼接符)|200w|00:00:21.947|00:00:08.591|00:00:30.95|00:00:33.322|00:00:35.438|
||16|长CLOB|20w|00:00:04.497|00:00:04.922|00:01:29.87|00:00:05.424|00:00:04.890|
||17|子查询返回多行|20w|00:00:25.126|00:00:25.215|00:00:05.19|00:01:01.644|00:01:03.597|
||18|子查询场景 1 条件|20w|00:00:25.422|00:00:24.857|00:00:05.06|00:00:25.381|00:00:25.648|
||19|子查询场景 2 and 条件|20w|00:00:28.464|00:00:29.666|　|00:00:28.642|00:00:28.221|
||20|子查询场景 100 and 条件|20w|00:10:37.666|00:10:45.130|　|00:10:40.135|00:10:43.074|
||21|子查询场景，条件过滤为子查询|20w|00:00:51.272|00:00:49.595|00:00:12.51|00:00:49.534|00:00:49.939|
||22|1024字段（int）|1w|00:00:16.488|00:00:05.417|　|00:00:12.037|00:00:12.224|
||23|insert指定表字段，子查询为select  
  pkg.value + 条件|20w|00:00:16.543|00:00:07.268|00:00:03.48|00:00:16.959|00:00:16.179|
||24|insert指定表字段，子查询为select  
  pkg.value + exists子查询条件|1w|00:00:18.063|00:00:17.206|00:00:00.69|00:00:17.852|00:00:17.681|
||25|insert指定表字段，子查询为select  
  pkg.value + exists子查询条件，条件变量经函数处理|1w|00:00:17.376|00:00:16.763|00:00:00.71|00:00:17.920|00:00:18.322|
||26|index by|200w|00:00:33.106|00:00:19.378|00:00:28.51|00:00:40.620|00:00:38.189|
||27|insertall|200w|00:00:31.614|00:00:31.375|00:00:58.47|00:00:39.343|00:00:41.703|
||28|local  
  UDT|200w|00:01:06.003|00:00:56.784|00:01:17.36|00:00:57.165|00:00:44.991|




  




  


性能SQL：

## Attachments:

[test.sh](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhM2FjIiwicmVmX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhNDEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3ODAwLCJleHAiOjE3ODI1NDQyMDB9.IMYsSbxuYI-rSjhNv5UaWZ_Yp6e3fJ9u_t24f0aetW8)

 (application/x-sh)    


[test_forallinsert_heap_large.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhM2IwIiwicmVmX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhNDEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3ODAwLCJleHAiOjE3ODI1NDQyMDB9.LUkJcqJ5znLXUoZWcKyHZvkC2RT4qhzvvjpmcCGtGb8)

 (application/octet-stream)    


[test_forallinsert_heap_rx1.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhM2FkIiwicmVmX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhNDEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3ODAwLCJleHAiOjE3ODI1NDQyMDB9.FJpC57wXGCPw9i9NPpr_GUkoQqF4rh7BO03jDYO4s98)

 (application/octet-stream)    


[test_forallinsert_heap_rx2.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhM2FlIiwicmVmX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhNDEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3ODAwLCJleHAiOjE3ODI1NDQyMDB9.gp4ZOgFlRxBXdvr6Vse152RNF7lRt6wQXoAwxstjqq0)

 (application/octet-stream)    


[test_forallinsert_heap_rx3.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhM2FmIiwicmVmX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhNDEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3ODAwLCJleHAiOjE3ODI1NDQyMDB9.L4NG9j2P682Q36Y8iMl_ZmOElUpnUwDr2vUiu2Z-e1g)

 (application/octet-stream)    


[test_forallinsert_lsc_large.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhM2IxIiwicmVmX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhNDEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3ODAwLCJleHAiOjE3ODI1NDQyMDB9.rTHcxFhrWcUVVsc_5dC323NSEBSuxQsaxiOddeUStWc)

 (application/octet-stream)    


[test_forallinsert_lsc_rx1.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhM2I5IiwicmVmX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhNDEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3ODAwLCJleHAiOjE3ODI1NDQyMDB9.fhkvzodN7e33UiSyNVd-Oz1bUQwtt3Jf_IoRPq5x1hY)

 (application/octet-stream)    


[test_forallinsert_lsc_rx2.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhM2IyIiwicmVmX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhNDEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3ODAwLCJleHAiOjE3ODI1NDQyMDB9.eegWIwYmfDVT0G7D137mHg_c7oSFsowV3mf1WWorzHI)

 (application/octet-stream)    


[test_forallinsert_lsc_rx3.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhM2JhIiwicmVmX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhNDEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3ODAwLCJleHAiOjE3ODI1NDQyMDB9.KxEIheso-ocNgQcd6jIImwhWl4csHvpUygwlGZY2IW4)

 (application/octet-stream)    


[test_forallinsert_select_heap.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhM2IzIiwicmVmX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhNDEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3ODAwLCJleHAiOjE3ODI1NDQyMDB9.BF3eKcaR5bpuGOv0OGP_1JfowKM-kvveXlJoVaMzzSI)

 (application/octet-stream)    


[test_forallinsert_select_lsc.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhM2JiIiwicmVmX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhNDEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3ODAwLCJleHAiOjE3ODI1NDQyMDB9.0Sc6-a5ejQwRq8WA3gGYIAtIIJ6xpEoyBlJ2CFZ9xHg)

 (application/octet-stream)    


[test_forallinsert_values_heap.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhM2JjIiwicmVmX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhNDEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3ODAwLCJleHAiOjE3ODI1NDQyMDB9.Wo3-yhBS6D8ENt7yMKAvl-WTqhstGpp2QCqpvKV_jIA)

 (application/octet-stream)    


[test_forallinsert_values_lsc.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhM2JkIiwicmVmX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhNDEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3ODAwLCJleHAiOjE3ODI1NDQyMDB9.7_W7JC1J8YAPPFFJ6FU6rJEygwddZRGLu6nIQEpsMwA)

 (application/octet-stream)    


[table_forallinsert_heap.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhM2I0IiwicmVmX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhNDEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3ODAwLCJleHAiOjE3ODI1NDQyMDB9.6cT2xRptzbgg-6piMti0hlWp6dK9jDRX7VvqcZ-81RQ)

 (application/octet-stream)    


[table_forallinsert_lsc.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhM2JlIiwicmVmX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhNDEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3ODAwLCJleHAiOjE3ODI1NDQyMDB9.pZTPWi6FEw6GRuAH-yK7zj2ZGguXBJ_k1vLAEbqY3sQ)

 (application/octet-stream)    


[table_insert.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhM2I1IiwicmVmX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhNDEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3ODAwLCJleHAiOjE3ODI1NDQyMDB9.zvC2mhn8u2OmSDDdhrTZnvppjdrepkukTP3Lk0uyAg4)

 (application/octet-stream)    


[test.sh](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhM2I2IiwicmVmX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhNDEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3ODAwLCJleHAiOjE3ODI1NDQyMDB9.DNj7V42efr3jtSvsfckUz2L_bOD8jmlTum_2FeAR14c)

 (application/x-sh)    


[test_forallinsert_lsc_rx1.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhM2JmIiwicmVmX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhNDEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3ODAwLCJleHAiOjE3ODI1NDQyMDB9.XWLumYqZKb94JIpJsxAjdMCeSLmKAUBi4INl7__vs1A)

 (application/octet-stream)    


[test_forallinsert_lsc_rx2.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhM2I3IiwicmVmX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhNDEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3ODAwLCJleHAiOjE3ODI1NDQyMDB9.DwtNVRG6JjGt6maekp8P0IiDBiBUqUmgR9alqwPFSMU)

 (application/octet-stream)    


[test_forallinsert_lsc_rx3.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhM2MwIiwicmVmX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhNDEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3ODAwLCJleHAiOjE3ODI1NDQyMDB9.EexfM1Bd22b776zeSdnoqX7qRUAAByXvUyj8NCAjNX4)

 (application/octet-stream)    


[test_forallinsert_select_heap.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhM2I4IiwicmVmX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhNDEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3ODAwLCJleHAiOjE3ODI1NDQyMDB9.mlzj_o9JcAzDC_DWaNvQfw-nVoYCXWDixb3WuerTrGY)

 (application/octet-stream)    


[test_forallinsert_select_lsc.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhM2MxIiwicmVmX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhNDEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3ODAwLCJleHAiOjE3ODI1NDQyMDB9.71fE8ZNM5XPeYIo1IJFAK1F7rFfIEEl3Vlm4zOA-sYY)

 (application/octet-stream)    


[test_forallinsert_values_heap.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhM2M3IiwicmVmX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhNDEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3ODAwLCJleHAiOjE3ODI1NDQyMDB9.VfOZPAPir5Ha6M_eTMKhuaRYA6_CTAcEoPDoNJZ46Aw)

 (application/octet-stream)    


[test_forallinsert_values_lsc.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhM2M4IiwicmVmX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhNDEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3ODAwLCJleHAiOjE3ODI1NDQyMDB9.-TBkCKPUtkLiVQufec96pduN7Ay4Pyb5Y-uYUkm0uKI)

 (application/octet-stream)    


[table_forallinsert_heap.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhM2M5IiwicmVmX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhNDEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3ODAwLCJleHAiOjE3ODI1NDQyMDB9._-GKXreE---AFL1rdmjN30xC1-2uZ7wzxrvEv8CAZKo)

 (application/octet-stream)    


[table_forallinsert_lsc.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhM2MyIiwicmVmX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhNDEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3ODAwLCJleHAiOjE3ODI1NDQyMDB9.c60hcj3_UF1tNQcMAerXbL85GrIj-FM12BEDrV9Sr5M)

 (application/octet-stream)    


[table_insert.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhM2MzIiwicmVmX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhNDEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3ODAwLCJleHAiOjE3ODI1NDQyMDB9.UuBjxOIleG8guJEzx4eyzyYWTlEhLrqJDWOXjzxbU24)

 (application/octet-stream)    


[test_forallinsert_heap_large.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhM2NhIiwicmVmX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhNDEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3ODAwLCJleHAiOjE3ODI1NDQyMDB9.-FlMjdGAHDZ9LbURNif-DuGdM8oojg8vgQ4FQKLlo4E)

 (application/octet-stream)    


[test.sh](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhM2M0IiwicmVmX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhNDEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3ODAwLCJleHAiOjE3ODI1NDQyMDB9.or9SezxZKtyr5ML-PdZJKZZFFzg2imhjGi6Twu2NjHc)

 (application/x-sh)    


[test_forallinsert_heap_rx1.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhM2M1IiwicmVmX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhNDEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3ODAwLCJleHAiOjE3ODI1NDQyMDB9.ftL09W2jHILgxemzvsGNA_KeKyhCs0d81Cqu_SBOVKc)

 (application/octet-stream)    


[test_forallinsert_heap_rx2.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhM2NiIiwicmVmX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhNDEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3ODAwLCJleHAiOjE3ODI1NDQyMDB9.fc6DMMt2Qrx9cK4bvkeQ3rOurWNhwBZEok2CkxxprPM)

 (application/octet-stream)    


[test_forallinsert_heap_rx3.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhM2M2IiwicmVmX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhNDEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3ODAwLCJleHAiOjE3ODI1NDQyMDB9.n4HFz9eT_foWTHKhIU9C6XI5WuHekpoD0xqFI8e29pQ)

 (application/octet-stream)    


[test_forallinsert_lsc_large.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhM2NjIiwicmVmX2lkIjoiNjc2MmE2OGZhMDNiODIzNDg2MGFhNDEwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3ODAwLCJleHAiOjE3ODI1NDQyMDB9.P_aq-93c2lBuNGsDOdkaB5Sc9ULMEMqeXVES-6fllQM)

 (application/octet-stream)    
