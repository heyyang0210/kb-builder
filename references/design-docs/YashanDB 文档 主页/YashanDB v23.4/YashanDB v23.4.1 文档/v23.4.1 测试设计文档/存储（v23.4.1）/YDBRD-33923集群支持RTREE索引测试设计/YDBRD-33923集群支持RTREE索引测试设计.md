# **1. 概述**

**SR链接：**  [https://pingcode.yasdb.com/pjm/items/6708e082e489dd0868f4fea6?](https://pingcode.yasdb.com/pjm/items/6708e082e489dd0868f4fea6?)  

#YDBRD-33923 集群支持RTREE

集群下可以给geometry类型创建rtree索引，可以做dml

# **2. 需求分析**

### **2.1 基本功能**

1. 支持创建rtree索引
1. 支持DML：插入，删除，更新，以及对应的回滚
1. 支持扫描，扫描接口：给定矩形框，返回所有和其相交的矩形框（匹配函数可以定制化）
1. 支持MVCC（基本事务能力，一致性查询）
1. 支持基本索引DDL
1. 支持一级分区/二级分区
1. 当前只放开2维float rtree index


### **2.2 功能限制**

- rtree索引只支持给geometry类型列创建
- 创建rtree index必须使用rtree关键字
- 不支持unique rtree索引
- rtree索引只支持单列索引，不支持多列复合rtree索引
- rtree索引不支持create/rebuild online
- rtree索引不支持reverse
- rtree索引不支持function
- rtree高度上限：24层   --可能构造不了
- 维度上限：6维  --目前支持2维
- 支持集群    (单机已验证)
- 不支持可串行化事务
- 不支持临时表


# **3. 测试设计方法**

### 3.1测试范围：

- 集群部署形态
- 存储表包括heap
- 表的类型涉及：普通表、分区表、  集群临时表不支持
- 索引的表空间：自定义表空间、加密表空间
- 索引类型：分区、全局、单列，多列索引拦截
- geom数据类型覆盖
- gv$INDEX视图
- explain/ select count(*) 查询对应rtree索引表


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
|一致性|不涉及|
|三方测试工具  
(sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR/testkill|涉及|
|HA|涉及|
|压力|不涉及|
|性能|不涉及|
|可维护性|不涉及|
|兼容性|不涉及|


语法功能采用  正交法、等价类划分、

功能场景法进行测试设计

# 4.   **详细测试设计**   

  [集群支持RTREE.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc0OTdmMDhhMWFkOWEzMzExZGUzYWM3IiwicmVmX2lkIjoiNjczYWYyMmY3MjgyMDZlZmI5MzFmMTZjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU5MTE3LCJleHAiOjE3ODI1NDU1MTd9.nKk4lC2B0sC7DDugwl49eSS2cGFpLIOYlhMlvXhfHvk)  

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


