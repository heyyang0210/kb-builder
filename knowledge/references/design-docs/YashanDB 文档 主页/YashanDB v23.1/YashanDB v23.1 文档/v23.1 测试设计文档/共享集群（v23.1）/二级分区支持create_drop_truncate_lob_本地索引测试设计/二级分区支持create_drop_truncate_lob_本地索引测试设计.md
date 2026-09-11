Created by 吕雷奇, last modified by  陈瑞 on 一月 04, 2024

# 1. 概述 

二级分区简单来说就是在原来的分区里再次根据指定字段划分子分区，range（interval），list，hash分区均可以两两组合形成二级分区，也可以和自己组成二级分区；

当前版本只交付除去interval的9种二级分区

|  
|range|hash|list|interval|
|---|---|---|---|---|
|range|range-range|hash-range|list-range|interval-range|
|hash|range-hash|hash-hash|list-hash|interval-hash|
|list|range-list|hash-list|list-list|interval-list|


# 2. 需求分析 

此次的交付范围为部署形态单机，需要主要测试范围为heap表，其他lsc，tac表拦截，分布式也需要有拦截用例;

交付的功能范围为二级分区种支持ddl操作中的create/drop/truncate 二级分区表，支持表中带lob列，以及本地索引的创建和删除；以及相关的新增视图。

设计sr：

  [Create/Drop/Truncate组合分区表 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=107385745)  

  [Create Index - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/YAS/Create+Index)  

  [视图 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=95096041)  

# 3. 测试设计方法 

本次转测范围主要支持了ddl的语法和相关功能，测试重点满足语法图的各个分支，对比Oracle的执行结果，采用的等价类划分，边界值，场景法组合及错误推测法进行设计 ；

# 4. 详细测试设计

  


加固场景：

1、覆盖create table as select 创建9种表

2、修改二级分区列数据类型，表属性

3、新增数据类型（nchar，nvarchar）等作为分区键（只有行存支持）

4、视图字段检查    
  DBA_PART_COL_STATISTICS    
  DBA_PART_HISTOGRAMS    
  DBA_PART_INDEXES    
  dba_lob_partition    
  DBA_PART_KEY_COLUMNS    
  DBA_PART_STORE    
  DBA_TAB_PARTITIONS    
  DBA_TAB_SUBPARTITIONS    
  DBA_SUBPART_KEY_COLUMNS    
  DBA_SUBPARTITION_TEMPLATES    
  DBA_LOB_SUBPARTITIONS    
  DBA_PART_TABLES    
  DBA_IND_EXPRESSIONS

检查项：

1、功能用例

2、错误码场景构造，检查报错信息准确，报错场景符合

  


# 5. 测试用例 

# 6. 测试框架设计

本次测试采用导入导出测试框架实现。

# 7. 测试环境说明

## Attachments:

[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZDFhMWFkOWEzMzExZGM3OTJiIiwicmVmX2lkIjoiNjczOTY5ZDE3MjgyMDZlZmI5MmVmN2Q4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5MTI2LCJleHAiOjE3ODIyOTU1MjZ9.ni4ir5_8TWZPXf5Q8EKH0GuEUDGJAL3UciUehFlrmWQ)

 (image/svg+xml)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZDE4OTcwYzJhZjRmNTFmYWI0IiwicmVmX2lkIjoiNjczOTY5ZDE3MjgyMDZlZmI5MmVmN2Q4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5MTI2LCJleHAiOjE3ODIyOTU1MjZ9.aNKRVAQb3GBjXweG-gkhpq773lfhVNgKDF-lSSz16EI)

 (image/svg+xml)    


[error.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZDFhMWFkOWEzMzExZGM3OTJkIiwicmVmX2lkIjoiNjczOTY5ZDE3MjgyMDZlZmI5MmVmN2Q4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5MTI2LCJleHAiOjE3ODIyOTU1MjZ9.eBXJntPzztBZH1GvbWqiqJeU_Nt1h2sQM6VzXQlp5TY)

 (image/svg+xml)    


[image2023-4-19_9-58-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZDE4OTcwYzJhZjRmNTFmYWI2IiwicmVmX2lkIjoiNjczOTY5ZDE3MjgyMDZlZmI5MmVmN2Q4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5MTI2LCJleHAiOjE3ODIyOTU1MjZ9.bGFFSJ6AZzAYdPR9GdyUF3OumRTPBYab0Iy6rmKIUGk)

 (image/png)    


[二级分区.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZDE4OTcwYzJhZjRmNTFmYWI3IiwicmVmX2lkIjoiNjczOTY5ZDE3MjgyMDZlZmI5MmVmN2Q4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5MTI2LCJleHAiOjE3ODIyOTU1MjZ9.8hVl2Vq9dXNSVorq5tQVJ3KCx_832p4dDQwpHLJl_MU)

 (application/x-xmind)    


[error.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZDE4OTcwYzJhZjRmNTFmYWI4IiwicmVmX2lkIjoiNjczOTY5ZDE3MjgyMDZlZmI5MmVmN2Q4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5MTI2LCJleHAiOjE3ODIyOTU1MjZ9.VGCTfA5HenElEfZ-Gh_c4ZiYL1wk7ckqaM_HsxHFt7Y)

 (image/svg+xml)    
