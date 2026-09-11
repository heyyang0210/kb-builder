Created by 李浩勇, last modified on 十一月 15, 2024

# **1. 概述**

本文描述FORALL INSERT支持批量插入的测试设计

SR链接：    [https://pingcode.yasdb.com/ship/ideas/66cd901d4283cf23d4f3e5d5](https://pingcode.yasdb.com/ship/ideas/66cd901d4283cf23d4f3e5d5)    ?    
  #YASHAN-3193 FORALL INSERT支持批量插入

# **2. 需求分析**

## 2.1 功能点分析

1. 在语法支持时支持批量插入，达到性能优化


# 3.   **详细测试设计**   

设计分析：

无新增删除功能，功能用例无需设计，复用历史 forall insert用例，只需设计性能用例。

测试点：

1、字段类型：

int, CLOB, BLOB, NCLOB, XMLTYPE, RAW(10), JSON, ROWID, UROWID, varchar(100), object, table, UDF(int), UDF(object), exp(运算表达式), exp(拼接符), 长CLOB

补充：varchar(32000)，char(8000)，number(20,5)

字符集，影响字符串类型

2、字段数量

单字段，多字段（1024）（100）

3、执行方式：

动态SQL，静态SQL

4、赋值方式

values ， 子查询select（select column,  select package.v(i)）

5、select 条件

带过滤条件，select 和 过滤条件中均包含数组元素

6、其他

insert all

触发器

补充：触发器中带forall语句

  


确认融选字段类型

(number  varchar(100)  date)

→200w

  


补充local数组应用/*/

稀疏数组



|　|　|　|　|　|导入方式|||||
|---|---|---|---|---|---|---|---|---|---|
|　|　|　|　|　|yahsan优化前|yahsan优化后|yahsan优化前|yahsan优化后|　|
|　|序号|表字段类型|对应SQL|数据量|forall静态SQL-values|　|forall动态SQL-values|　|table批量导入|
|　|0|int-导入常量|表：  

    table_forallinsert_heap.sql

    

    SQL：

    test_forallinsert_values_heap.sql

    

    日志：

    log/log_heap_[1-38]

    |200w|　|00:00:02.224|　|　|　|
|行存|1|int||200w|00:00:15.385|00:00:02.063|00:00:28.627|00:00:21.847|00:00:01.357|
||2|CLOB||200w|00:00:15.048|00:00:02.359|00:00:26.279|00:00:22.344|00:00:01.949|
||3|BLOB||200w|00:00:14.925|00:00:02.293|00:00:24.845|00:00:23.207|00:00:01.953|
||4|NCLOB||200w|00:00:15.616|00:00:02.356|00:00:24.824|00:00:22.222|00:00:02.155|
||5|XMLTYPE||200w|00:00:15.224|00:00:02.865|00:00:25.329|00:00:22.361|00:00:01.997|
||6|RAW(10)||200w|00:00:15.070|00:00:02.187|00:00:25.159|00:00:21.996|00:00:01.929|
||7|JSON||200w|00:00:15.212|00:00:02.384|00:00:25.441|00:00:27.552|00:00:02.525|
||8|ROWID||200w|00:00:14.756|00:00:02.146|00:00:24.835|00:00:21.664|00:00:01.476|
||9|UROWID||200w|00:00:14.885|00:00:02.026|00:00:25.510|00:00:26.437|00:00:01.752|
||10|varchar(100)||200w|00:00:15.030|00:00:02.150|00:00:25.237|00:00:25.700|00:00:02.168|
||11|nvarchar(8000)||20w|00:00:11.753|00:00:10.206|00:00:14.283|00:00:12.778|00:00:43.138|
||12|varchar(32000)||2w|00:00:05.375|00:00:05.936|00:00:06.622|00:00:06.682|00:00:56.806|
||13|object||200w|00:00:25.156|00:00:16.245|00:00:38.851|00:00:31.993|/|
||14|table||200w|00:00:52.669|00:00:36.066|00:01:03.240|00:00:50.833|/|
||15|UDF(int)||200w|00:00:28.740|00:00:08.212|00:00:59.347|00:00:45.604|/|
||16|UDF(object)||200w|00:00:37.367|00:00:37.089|00:00:56.435|00:00:54.860|/|
||17|exp(运算表达式)||200w|00:00:18.130|00:00:03.039|00:00:29.229|00:00:25.142|/|
||18|exp(拼接符)||200w|00:00:19.144|00:00:03.093|00:00:31.401|00:00:26.100|/|
||19|长CLOB||20w|00:00:24.112|00:00:22.707|00:00:00.023|00:00:00.083|00:01:02.984|
||20|1024字段（int）|test_forallinsert_heap_large.sql|20w|00:00:15.562|00:00:04.980 |00:00:12.116|00:00:11.104|/|
||21|融选场景|test_forallinsert_heap_rx.sql|200w|00:00:26.901|00:00:08.205 |00:00:24.697|00:00:17.014|00:00:21.668|
||22|insertall|test_forallinsert_heap_insertall.sql|200w|00:00:04.746|00:00:05.465 |00:00:05.249|00:00:03.946|/|
||23|indices of|test_forallinsert_heap_index.sql|200w|00:00:03.457|00:00:00.483 |00:00:11.805|00:00:03.630|/|
||24|local|test_forallinsert_heap_local.sql|200w|00:00:05.722|00:00:01.437 |00:00:04.947|00:00:04.030|/|
|　|0|int-导入常量|　|200w|　|00:00:07.447|　|　|　|
|列存|1|int|表：  

    table_forallinsert_lsc.sql

    

    SQL：

    test_forallinsert_values_lsc.sql

    

    日志：

    log/log_lsc_[1-38]|200w|00:00:46.950|00:00:08.875|00:01:08.996|00:00:53.932|00:00:07.751|
||2|CLOB||200w|00:00:49.414|00:00:13.588|00:01:07.449|00:00:50.336|00:00:19.187|
||3|BLOB||200w|00:00:50.375|00:00:12.440|00:01:00.972|00:00:54.996|00:00:12.444|
||4|RAW(10)||200w|00:00:43.353|00:00:08.912|00:01:04.295|00:00:51.013|00:00:07.750|
||5|JSON||200w|00:00:50.133|00:00:12.715|00:01:05.349|00:01:18.454|00:00:18.069|
||6|UROWID||200w|00:00:42.022|00:00:08.102|00:01:00.081|00:00:49.627|00:00:08.389|
||7|varchar(100)||200w|00:00:38.295|00:00:09.045|00:01:00.744|00:00:51.334|00:00:09.151|
||8|nvarchar(8000)||20w|00:00:10.128|00:00:07.077|00:00:15.941|00:00:12.844|00:00:42.769|
||9|varchar(32000)||20w|00:00:47.019|00:00:04.275|00:00:07.650|00:00:07.446|00:00:50.873|
||10|exp(运算表达式)||200w|00:00:52.541|00:00:08.273|00:01:35.099|00:00:56.126|/|
||11|exp(拼接符)||200w|00:01:11.739|00:00:15.021|00:01:44.905|00:01:02.298|/|
||12|长CLOB||20w|00:00:14.487|00:00:05.248|00:00:02.463|00:00:01.204|core|


  






  


性能SQL：

## Attachments:

[test.sh](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OGRmIiwicmVmX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OTQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NzQyLCJleHAiOjE3ODI1NDQxNDJ9.DGnPgYP1FrEWo_-B74ACv9NxZTAZrriacSsgUDrX8SY)

 (application/x-sh)    


[test_forallinsert_heap_large.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OGUzIiwicmVmX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OTQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NzQyLCJleHAiOjE3ODI1NDQxNDJ9.CtoD48XU08KOVLmlcyveMOmmxiKuv0t-XMhJ3cQ-SVc)

 (application/octet-stream)    


[test_forallinsert_heap_rx1.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OGUwIiwicmVmX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OTQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NzQyLCJleHAiOjE3ODI1NDQxNDJ9.wxlRRuYA9PtiKLQMmllAxq9rc69oBr_UOV3fqp6ggfM)

 (application/octet-stream)    


[test_forallinsert_heap_rx2.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OGUxIiwicmVmX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OTQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NzQyLCJleHAiOjE3ODI1NDQxNDJ9.hc9Y_Q7y1jW9h7U2eG5qlGMt9gaYk8oODeaHxE00sSU)

 (application/octet-stream)    


[test_forallinsert_heap_rx3.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OGUyIiwicmVmX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OTQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NzQyLCJleHAiOjE3ODI1NDQxNDJ9.OSQKOzAyHrpjmrZROTf9i3FE4GCXFM7Dx0ZHCiml6NM)

 (application/octet-stream)    


[test_forallinsert_lsc_large.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OGU0IiwicmVmX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OTQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NzQyLCJleHAiOjE3ODI1NDQxNDJ9.DOmjlpjULRk7gGr7E5xO5Cq0qtDE5aRn96ZGiGebA8M)

 (application/octet-stream)    


[test_forallinsert_lsc_rx1.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OGVjIiwicmVmX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OTQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NzQyLCJleHAiOjE3ODI1NDQxNDJ9.1P8DLjtWgVjHZwf3_UPh9LX3o8jXCaRUn0xEj9SuZdk)

 (application/octet-stream)    


[test_forallinsert_lsc_rx2.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OGU1IiwicmVmX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OTQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NzQyLCJleHAiOjE3ODI1NDQxNDJ9.1wFhAJn1V71v551u3KdMPuVGhlzPQU4nysKo3d-qPH0)

 (application/octet-stream)    


[test_forallinsert_lsc_rx3.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OGVkIiwicmVmX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OTQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NzQyLCJleHAiOjE3ODI1NDQxNDJ9.Xmj_Qu9OZBNxlgmZLH-zMK6kY_VF1Ddpvt8Q4QjNueE)

 (application/octet-stream)    


[test_forallinsert_select_heap.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OGU2IiwicmVmX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OTQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NzQyLCJleHAiOjE3ODI1NDQxNDJ9.roPvsD41EztQ5OOUrkHcDlYLw-C4S6rY82fUspzUrgk)

 (application/octet-stream)    


[test_forallinsert_select_lsc.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OGVlIiwicmVmX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OTQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NzQyLCJleHAiOjE3ODI1NDQxNDJ9.YLf5Ydq5LUv-oSTZ25iJtIOOP9__gJDoJL5WE2qc3xo)

 (application/octet-stream)    


[test_forallinsert_values_heap.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OGVmIiwicmVmX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OTQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NzQyLCJleHAiOjE3ODI1NDQxNDJ9.zW5izDeXwRhIGas0QBXd_rLKUtvPjuiTJSChLo6WnYo)

 (application/octet-stream)    


[test_forallinsert_values_lsc.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OGYwIiwicmVmX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OTQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NzQyLCJleHAiOjE3ODI1NDQxNDJ9.SyOW1cdexMqWTjKE79nEndgKryzjMJAKK0MVev1kD5w)

 (application/octet-stream)    


[table_forallinsert_heap.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OGU3IiwicmVmX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OTQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NzQyLCJleHAiOjE3ODI1NDQxNDJ9.K38zgorf8E_C7DB4OdsKDyy1GEeNQYaOfxCO0x_CCBg)

 (application/octet-stream)    


[table_forallinsert_lsc.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OGYxIiwicmVmX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OTQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NzQyLCJleHAiOjE3ODI1NDQxNDJ9.QdRoB2Am9N4woUPYQ-lBYC10Qs6cVdi6spDIOfDMFdU)

 (application/octet-stream)    


[table_insert.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OGU4IiwicmVmX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OTQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NzQyLCJleHAiOjE3ODI1NDQxNDJ9.qu8GgZ2hbLCjDpvYhscyZzodOR568WuNB085t3dZLmE)

 (application/octet-stream)    


[test.sh](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OGU5IiwicmVmX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OTQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NzQyLCJleHAiOjE3ODI1NDQxNDJ9.a9_Z1OAeoQwCtaDhY1EmLMOWJq1aV6v33Ey0XguBHbs)

 (application/x-sh)    


[test_forallinsert_lsc_rx1.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OGYyIiwicmVmX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OTQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NzQyLCJleHAiOjE3ODI1NDQxNDJ9.cL1PJvxTPKD__MMIVqXU2s_StOjR0iTJHcdBa8lFb1Q)

 (application/octet-stream)    


[test_forallinsert_lsc_rx2.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OGVhIiwicmVmX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OTQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NzQyLCJleHAiOjE3ODI1NDQxNDJ9.nu7o4DKbmeVRJQHTq8XZm-weTevGQBiiKHh_Yzs5D9k)

 (application/octet-stream)    


[test_forallinsert_lsc_rx3.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OGYzIiwicmVmX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OTQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NzQyLCJleHAiOjE3ODI1NDQxNDJ9.ke5gmh4Ok26k3aB8ieEZvm_QZxf6wgZ3DvDPmPjBFXY)

 (application/octet-stream)    


[test_forallinsert_select_heap.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OGViIiwicmVmX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OTQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NzQyLCJleHAiOjE3ODI1NDQxNDJ9.gcAkgsx2zEZJjeksY_wVl3dPsBS4sV67-lAHwQbhgxo)

 (application/octet-stream)    


[test_forallinsert_select_lsc.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OGY0IiwicmVmX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OTQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NzQyLCJleHAiOjE3ODI1NDQxNDJ9.npDs587tfUwBntV3mqqrEQMdhel11CmhkYK1AYLRKGY)

 (application/octet-stream)    


[test_forallinsert_values_heap.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OGZhIiwicmVmX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OTQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NzQyLCJleHAiOjE3ODI1NDQxNDJ9.WsMTpxXiqeHeJirUyRMFJ_Uc5ISvSKfWny4JM8r3d2w)

 (application/octet-stream)    


[test_forallinsert_values_lsc.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OGZiIiwicmVmX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OTQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NzQyLCJleHAiOjE3ODI1NDQxNDJ9.h6jRe6ws54ScVGAaLbDdQFpJdKKnjAr_FIIXAeiTD1w)

 (application/octet-stream)    


[table_forallinsert_heap.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OGZjIiwicmVmX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OTQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NzQyLCJleHAiOjE3ODI1NDQxNDJ9.FmfIR7ZcHHlSs3122OxjSpMKnI5bRsSE_dX_gFCtkLo)

 (application/octet-stream)    


[table_forallinsert_lsc.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OGY1IiwicmVmX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OTQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NzQyLCJleHAiOjE3ODI1NDQxNDJ9.-rb4kMEhADPBwuhboTXTCy4L-tR789VGe3HBluBT-WY)

 (application/octet-stream)    


[table_insert.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OGY2IiwicmVmX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OTQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NzQyLCJleHAiOjE3ODI1NDQxNDJ9.OjJZ5W7r-Ktryqro4nOg3g7l5W4v09Kb1_5HF7ZCR4g)

 (application/octet-stream)    


[test_forallinsert_heap_large.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OGZkIiwicmVmX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OTQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NzQyLCJleHAiOjE3ODI1NDQxNDJ9.2NTrQtvIiRHM8VK9Jw_9sj6WrpdfF8nE8vXnzBYz3TA)

 (application/octet-stream)    


[test.sh](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OGY3IiwicmVmX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OTQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NzQyLCJleHAiOjE3ODI1NDQxNDJ9.gI6wA6Qc3THV06tQJL_ywBgjOkf6vm6no2QjAD7LA0s)

 (application/x-sh)    


[test_forallinsert_heap_rx1.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OGY4IiwicmVmX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OTQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NzQyLCJleHAiOjE3ODI1NDQxNDJ9.c1YRAgHySMtFurch8D4HgwYId6nimOmQ2x1PbvH32q0)

 (application/octet-stream)    


[test_forallinsert_heap_rx2.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OGZlIiwicmVmX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OTQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NzQyLCJleHAiOjE3ODI1NDQxNDJ9.uLqadRxoAUKzSI1ZFeprMJ9NoNqm8yx4NOpzFwn2Oe8)

 (application/octet-stream)    


[test_forallinsert_heap_rx3.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OGY5IiwicmVmX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OTQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NzQyLCJleHAiOjE3ODI1NDQxNDJ9.gUxYnTIA4FoiP62tiQrY5gdlq9dxHkapCiKkP_uyVRI)

 (application/octet-stream)    


[test_forallinsert_lsc_large.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OGZmIiwicmVmX2lkIjoiNjc2MjczZWJkMmJhZmYwZmQ1NWQ1OTQzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU3NzQyLCJleHAiOjE3ODI1NDQxNDJ9.fa72RFyCh7J_gPSgsvCqB4f4MQTgO78nNRknu3Uh7s4)

 (application/octet-stream)    
