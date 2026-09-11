Created by 刘大境, last modified on 三月 21, 2024

# **1. 概述**

**SR: **    [[YDBRD-14057] 二级分区支持alter index - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-14057)  

**开发设计文档：**    [复制从 ALTER INDEX - 刘大境 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=109591798)  

支持二级分区修改变更索引属性

local索引无法自己add partition或者drop partition 索引分区的add/drop跟随表的分区的add/drop

# **2.需求分析**

1.数据管理：通过对索引进行二级分区，可以更有效地管理大量数据，使得数据的存储和检索更加高效。特别是对于大型表或者频繁更新的表来说，二级分区可以有助于减少索引的维护成本。

2.性能优化：二级分区可以使得数据库在执行查询时可以更快地定位到所需的数据块，从而提高查询性能。特别是对于范围查询或者按时间范围进行检索的场景，二级分区可以显著提升查询效率。

3.数据归档：对于历史数据的归档和管理，二级分区可以帮助将旧数据和新数据进行有效分离，便于进行数据的归档和备份。

4.数据安全：通过对索引进行二级分区，可以更好地控制和管理不同数据的访问权限，实现数据安全和隔离。

**规格约束：**

|功能|结果|
|---|---|
|modify partition coalesce|报错|
|modify partition physicalAttr|分区和子分区都会修改，对于hash分区会报错|
|modify partition unsuable|该分区下的所有子分区都变为unusable|
|modify subpartition coalesce|成功|
|modify subpartition physicalAttr|报错|
|modify subpartition unusable|该子分区变为unusable|
|rebuild partition|报错无法对有子分区的分区进行rebuild|
|rebuild subpartition|成功|


# 3.  **测试设计方法**

(1) 主要采用场景法和错误推算法及边界测试法进行设计

1.九种分区类型下hash-hash、hash-list、hash-range、 range-range、range-hash、range-list、list-list、list-range、list-hash

2.采用4种不同表空间类型, MMS、自定义、加密、压缩

3.local索引，唯一索引、函数索引、反向索引、普通索引

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

|编号|测试场景|有效类|无效类|异常场景|备注|
|---|---|---|---|---|---|
|1|alter index modify   partition |unsuable|coalesce,带物理属性报错：usable/visible/invisible 5/pctfree 2|带列名 不带属性(modify partition p1),不带列名，不带属性(modify partition)|对hash分区修改物理属性会报错|
|2|alter index modify   subpartition |unsuable,coalesce|带物理属性报错：usable/visible/invisible 5/pctfree 2|带列名 不带属性(modify subpartition p1),不带列名，不带属性(modify subpartition)|查询视图,dba_tab_subpartitions,dba_ind_subpartitions|
|3|alter index rebuild   partition|rebuild带表空间名/不带表空间+ ,compress/nocompress,logging/nologging,parallel 2/noparallel,initrans 5/pctfree 2|usable/visible/invisible 5/online/offline/reverse/noreverse|带列名 不带属性 (rebuild partition p1),不带列名，不带属性(rebuild partition)|  
|
|4|alter index rebuild   subpartition|rebuild带表空间名/不带表空间+,online,compress/nocompress,logging/nologging,parallel 2/noparallel,initrans 5/pctfree 2|usable/visible/invisible 5/pctfree 2/offline/reverse|带列名 不带属性(rebuild subpartition p2),不带列名，不带属性(rebuild subpartition)|  
|
|5|先modify partition/subpartition,,后rebuild partition/subpartition，,先rebuild partition/subpartition,,后modify partition/subpartition.|  
|  
|  
|  
|
|6|DML操作 insert/update/delete|  
|  
|  
|加查询观测|
|7|truncate partition/subpartition, alter index modify/rebuild|  
,  
|  
|  
|  
|
|8|add partition/subpartition，alter index modify/rebuild|  
|  
|  
|  
|
|9|指定drop partition/subpartition，alter index modify/rebuild|  
|  
|  
|hash分区 drop partition 报错|
|10|构造数据的时候加上lob列|  
|  
|  
|  
|
|11|触发跨分区更新和其他dml的并发|  
|  
|  
|  
|
|12|alter index modify/rebuild并发,rebuild online+DML并发,add/drop partition/subpartition+alter index并发,alter index modify/rebuild+ DML并发|  
|  
|集群环境+testkill环境下是否有拦截？|单机testkill框架下无core|
|13|HA环境下，,主机add/drop partition/subpartition列，主备切换 执行alter index modify/rebuild.备机通过dba_ind_subpartitions视图可查,DML操作 insert/update/delete  备份恢复|  
|  
|  
|  
|


# 5.   **测试框架设计**

自动化用例添加到YAT框架以及HA框架

# 6.   **测试环境说明**

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机|


## Attachments:

[二级分区支持alter index modify partition文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZmI4OTcwYzJhZjRmNTFmYjY1IiwicmVmX2lkIjoiNjczOTY5ZmI1OTNmOTljOWZmMjM1NGFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNTQxLCJleHAiOjE3ODIyOTY5NDF9.1aWMEZw-rtg73ROep12XG8rTkoLKFtJ0zwnQWjChUNg)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
