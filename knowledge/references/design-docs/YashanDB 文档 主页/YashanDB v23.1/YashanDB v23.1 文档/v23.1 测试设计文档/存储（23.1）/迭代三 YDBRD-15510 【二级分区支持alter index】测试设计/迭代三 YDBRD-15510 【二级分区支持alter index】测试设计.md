Created by 刘大境, last modified on 三月 21, 2024

# **1. 概述**

**此次的交付范围为部署形态单机，需要主要测试范围为heap表，其他lsc，tac表拦截**

**交付的功能范围为二级分区种支持ddl/dml操作中的alter/insert/update/delete   一、二级分区表”，支持表中带lob列，以及本地索引的修改和删除。**

# SR：    [[YDBRD-15510] 二级分区支持alter index - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-15510)  

**设计文档：**    [ALTER INDEX - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/YAS/ALTER+INDEX)  

# **2.需求分析**

1.数据管理：通过对索引进行二级分区，可以更有效地管理大量数据，使得数据的存储和检索更加高效。特别是对于大型表或者频繁更新的表来说，二级分区可以有助于减少索引的维护成本。

2.性能优化：二级分区可以使得数据库在执行查询时可以更快地定位到所需的数据块，从而提高查询性能。特别是对于范围查询或者按时间范围进行检索的场景，二级分区可以显著提升查询效率。

3.数据归档：对于历史数据的归档和管理，二级分区可以帮助将旧数据和新数据进行有效分离，便于进行数据的归档和备份。

4.数据安全：通过对索引进行二级分区，可以更好地控制和管理不同数据的访问权限，实现数据安全和隔离。

# 3.   **测试设计方法**

(1) 主要采用场景法和错误推算法及边界测试法进行设计

1.覆盖现有支持/不支持的索引物理属性，边界值，常量、负数、小数值

2.大分区下边界，修改索引属性

3.修改索引属性前后带DDL/DML操作

|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|是|
|一致性|/|
|安全|/|
|HA|是|
|压力|/|
|性能|/|
|资料|是|


  


# **4.详细测试设计**

|编号|测试场景|有效类|无效类|备注|
|---|---|---|---|---|
|1|alter index语法|initrans +常量,visible,invisible,unusable,  
|initrans + 小数值、负数,coalesce |  
|
|2|alter index + DML操作insert/update/delete|  
|  
|  
|
|3|构造数据的时候加上lob列|  
|  
|  
|
|4|触发跨分区更新和其他dml的并发|  
|  
|  
|
|5|1M-1子分区下 alter index |1个子分区下alter index|  
|  
|
|6|1级分区alter index|  
|  
|  
|
|7|  
|alter index tb_index_01 initrans 2;|成功|  
|
|8|  
|alter index tb_index_01 visible;|成功|  
|
|9|  
|alter index tb_index_01 invisible;|成功|  
|
|10|  
|alter index tb_index_01 unusable;|成功|  
|
|11|  
|alter index tb_index_01 coalesce;|成功|  
|


# 5.   **测试框架设计**

自动化用例添加到YAT框架以及HA框架

# 6.   **测试用例**

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机|


  


## Attachments:

[image2023-6-8_9-32-46.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZmE4OTcwYzJhZjRmNTFmYjYzIiwicmVmX2lkIjoiNjczOTY5ZmE1OTNmOTljOWZmMjM1NGE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNTMxLCJleHAiOjE3ODIyOTY5MzF9.jeGBrveR9SJNO-V5bK2AWqjR-26EvRZOI4ErWYaqVL4)

 (image/png)    


[image2023-6-16_15-3-50.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZmE4OTcwYzJhZjRmNTFmYjY0IiwicmVmX2lkIjoiNjczOTY5ZmE1OTNmOTljOWZmMjM1NGE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNTMxLCJleHAiOjE3ODIyOTY5MzF9.SLwQHufKiV3DT-7G7axzllDxGFJzDjCKc1YHw8HQI9M)

 (image/png)    


[二级分区支持alter index文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZmFhMWFkOWEzMzExZGM3OWRjIiwicmVmX2lkIjoiNjczOTY5ZmE1OTNmOTljOWZmMjM1NGE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNTMxLCJleHAiOjE3ODIyOTY5MzF9.XFr00YedUoNFdG8lAlvObQNa9HaPYTgm6vwQxntyLVg)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
