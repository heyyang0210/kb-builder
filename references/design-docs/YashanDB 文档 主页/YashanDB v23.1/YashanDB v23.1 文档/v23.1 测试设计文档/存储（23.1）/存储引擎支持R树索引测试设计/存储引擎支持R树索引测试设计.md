Created by 陈瑞, last modified on 三月 27, 2024

# **1. 概述**

**本设计文档，支持给geometry类型创建rtree 索引。**

  [YDBRD-13240](https://jira.yasdb.com/browse/YDBRD-13240?src=confmacro)    -  存储引擎支持R树索引  完成

开发设计：    [Rtree设计文档 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=113970572)  

# **2. 需求分析**

### **2.1 基本功能**

1. 支持创建rtree索引
1. 支持DML：插入，删除，更新，以及对应的回滚
1. 支持扫描，扫描接口：给定矩形框，返回所有和其相交的矩形框（匹配函数可以定制化）
1. 支持MVCC（基本事务能力，一致性查询）
1. 支持基本索引DDL
1. 支持分区
1. 当前只放开2维float rtree index


### **2.**  **2**  ** 功能限制**

- rtree索引只支持给geometry类型列创建
- 创建rtree index必须使用rtree关键字
- 不支持unique rtree索引
- rtree索引只支持单列索引，不支持多列复合rtree索引
- rtree索引不支持create/rebuild online
- rtree索引不支持reverse
- rtree索引不支持function
- rtree高度上限：24层   --可能构造不了
- 维度上限：6维  --目前支持2维
- 支持单机
- 不支持可串行化事务
- 不支持临时表


# **3. 测试设计方法**

### 3.1测试范围：

- 单机、HA、分布式、集群部署形态，分布式和集群应该拦截
- 存储表包括heap、swf（tac,lsc），列存不支持拦截
- 表的类型涉及：普通表、分区表、临时表不支持
- 索引的表空间：自定义表空间、mms、bucket、加密表空间、压缩表空间
- 索引类型：分区、全局、单列，单列索引拦截
- geom数据类型覆盖


create index / alter index /drop index 语法树覆盖

存储功能场景：触发R树内部compact、split等操作

dml执行及并发控制

dba_indexes 索引类型新增values

一致性（索引扫描支持后补测）

### 3.2 测试观察点

1、dml 执行正常

2、语法拦截正常

3、系统表正常

### 3.3专项覆盖

|专项|是否涉及|
|:---|:---|
|并发|涉及|
|长稳|不涉及|
|一致性|涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR/testkill|涉及|
|HA|涉及|
|压力|涉及|
|性能|不涉及|
|可维护性|不涉及|
|兼容性|不涉及|


语法功能采用  正交法、  等价类划分、

功能场景法进行测试设计

# 4.   **详细测试设计**   

# 5.   **测试用例**

# 6.   **测试框架设计**

1. 功能自动化用例添加到yasft
1. 并发用例使用testkill框架


# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机|


## Attachments:

[rac集群适配trigger测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Zjk4OTcwYzJhZjRmNTFmYjYwIiwicmVmX2lkIjoiNjczOTY5Zjk1OTNmOTljOWZmMjM1NDljIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNTAzLCJleHAiOjE3ODIyOTY5MDN9.ngZm8mivrC_lzOFX-giq91_fRyfzQ5EXhseJydJ61gY)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[触发器适配RAC.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Zjk4OTcwYzJhZjRmNTFmYjYxIiwicmVmX2lkIjoiNjczOTY5Zjk1OTNmOTljOWZmMjM1NDljIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNTAzLCJleHAiOjE3ODIyOTY5MDN9.S1nd9e5UHLugDGABKhBtABON8S2-0EzM72y1VhFwcxI)

 (application/x-xmind)    


[存储引擎支持R树索引.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZjlhMWFkOWEzMzExZGM3OWQ3IiwicmVmX2lkIjoiNjczOTY5Zjk1OTNmOTljOWZmMjM1NDljIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNTAzLCJleHAiOjE3ODIyOTY5MDN9._Ib8d46Id4hNshRJadUBsRwI45ZIRybOpqOBwZ1BPxA)

 (application/x-xmind)    


[存储引擎支持Rtree索引.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZjlhMWFkOWEzMzExZGM3OWQ4IiwicmVmX2lkIjoiNjczOTY5Zjk1OTNmOTljOWZmMjM1NDljIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNTAzLCJleHAiOjE3ODIyOTY5MDN9.M57OF2DQ2ZPGBFCO5szmFcUAfO23Ct5x7PJwYqQwU_8)

 (application/x-xmind)    


[rtree索引.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZjlhMWFkOWEzMzExZGM3OWQ5IiwicmVmX2lkIjoiNjczOTY5Zjk1OTNmOTljOWZmMjM1NDljIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNTAzLCJleHAiOjE3ODIyOTY5MDN9.brWvx5Us5qpWAIcuw59MMdopOsjVio5wkj7TmudhKFI)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
