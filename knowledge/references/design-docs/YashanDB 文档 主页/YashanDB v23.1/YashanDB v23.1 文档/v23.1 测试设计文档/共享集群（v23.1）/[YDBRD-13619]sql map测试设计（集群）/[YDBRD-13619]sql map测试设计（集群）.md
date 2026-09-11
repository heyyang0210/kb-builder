Created by 杨锡昌, last modified on 十一月 14, 2023

# **1. 概述**

本文描述sqlmap的测试设计（集群）

# **2. 需求分析**

** SR:**    [YDBRD-13619](https://jira.yasdb.com/browse/YDBRD-13619?src=confmacro)    **-**  **SQLMAP元数据的集群化改造**  **完成**

**开发设计文档:**    [复制从 SQLMAP元数据的集群化改造](https://conf.yasdb.com/pages/viewpage.action?pageId=115149952&moved=true)    ** **

#### 2.1 参数

设置 SQL MAP 开关 _sql_map ， 默认为 false , 可取值 true, false. 

system 级别 设置

#### 2.2 语法

参考单机的语法结构：

（1）向sql_map$ 系统表添加内容

CREATE SQLMAP  name (user_name, '原始语句',  '映射语句');

其中：user_name 可以指定为具体用户名称（只支持1个用户名，不支持',' 分隔指定多个用户名）， 也可以指定all 代表所有用户，在create sqlmap 时，源sql 和目标sql 有个类型验证，两者需要一致

  


该语句类型为DDL语句类型

|  `create_sqlmap = CREATE SQLMAP name (user_name, `      `'sql'`      `, `      `'map_sql'`      `).`  |
|:---|


![](https://pingcode.yasdb.com/atlas/files/public/673969aca1ad9a3311dc7846/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUNBQUFBQUFCQUFBQUFBRUFBQUFBRkFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDgyODAsImV4cCI6MTc4MjIxOTA4MH0.Q1ifEvrAfcY-GU4BrzHOOws7Cy5wfghNxZTKBUvt5cE)

（2）从sql_map$系统表删除内容

DROP SQLMAP name;

|  `drop_sqlmap = DROP SQLMAP name.`  |
|:---|


![](https://pingcode.yasdb.com/atlas/files/public/673969aca1ad9a3311dc7847/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUNBQUFBQUFCQUFBQUFBRUFBQUFBRkFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDgyODAsImV4cCI6MTc4MjIxOTA4MH0.Q1ifEvrAfcY-GU4BrzHOOws7Cy5wfghNxZTKBUvt5cE)

该语句类型为DDL语句类型

# **3. 测试设计方法**

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计

3.1测试范围

支持单机支持的所有语法

  


3.2基本功能、权限测试

在单实例上执行单机现有用例

功能：    [standalone/testcase/ddl_02/sqlmap · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/ddl_02/sqlmap)  

  


3.2专项覆盖

|专项|是否涉及|说明|
|:---|:---|:---|
|并发|涉及|  
|
|长稳|不涉及|框架/工程暂不支持，SIT补充|
|一致性|不涉及|  
|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|  
|
|安全|不涉及|  
|
|HA|不涉及|  
|
|压力|不涉及|  
|
|性能|不涉及|  
|
|可维护性|不涉及|  
|
|兼容性|不涉及|  
|


  


3.3 集群下多实例交互

|输入条件|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|
|不同schema|regress、sys、普通用户：实例1 create sqlmap，实例2 查询sqlmap，实例3 创建同名的sqlmap|  
|create or replace sqlmap|  
|
|同个schema|实例1 create sqlmap，实例2 查询slqmap，实例3 创建同名的sqlmap，sql和map_sql与实例1不同|  
|  
|  
|
|  
|实例1 create sqlmap，实例2 查询slqmap，实例3 创建同名的sqlmap，sql和map_sql与实例1相同|  
|  
|  
|
|  
|实例1 create sqlmap1，实例2 创建sqlmap2 ,sql与实例1一致，map_sql不同，实例3 查询sqlmap1，sqlmap2|  
|  
|  
|
|  
|实例1 create sqlmap1，实例2 创建sqlmap2 ,sql不同，map_sql实例1一致，实例3 查询sqlmap1，sqlmap2|  
|  
|  
|
|  
|实例1 创建ALL下的sqlmap，实例2查询sqlmap，实例3在本schema下创建同名的sqlmap|  
|  
|  
|
|  
|实例1 create sqlmap，实例2 drop sqlmap ，实例3 查询sqlmap后再次drop|  
|  
|  
|
|  
|实例1 create sqlmap A为长语句映射成B短语句，实例2，3查看结果|  
|  
|  
|
|  
|实例1 create sqlmap A为短语句映射成A长语句，实例2，3查看结果|  
|  
|  
|
|异常情况|实例1 create sqlmap A映射B后，实例2 将B中使用的table被drop/alter，实例3查询结果|  
|  
|  
|
|  
|实例1 create sqlmap A映射B后，实例2 查询结果，实例3 将A中被使用的table被drop/alter再次查询结果|  
|  
|  
|
|  
|实例1 create sqlmap A映射B，B中使用的view被drop/replace，实例2再次创建相同的sqlmap，实例3查询结果|  
|  
|  
|
|  
|实例1 create sqlmap A映射B后，实例2 将A中使用的table被drop/alter，实例3查看|  
|  
|  
|
|  
|实例1 create sqlmap A映射B后，实例2 将A中使用的view被drop/replace，实例3查看|  
|  
|  
|
|并发|多个实例之间使用的时候同时删除sqlmap，使用的时候删除依赖的对象|  
|  
|  
|


3.4配置参数测试

|输入条件|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|
|取值|某个实列设置为true/false时，其他实例查看同步打开/关闭开关及映射|  
|1，0，yes，no，true，false|  
|
|设置级别(重启生效)|某个实例设置alter system scope = spfile，该实例重启，其他实例查询|  
|alter system scpoe = memory|  
|
|  
|某个实例设置alter system scope = spfile，该实例不重启，其他实例重启后查询|  
|  
|  
|
|  
|某个实例设置alter system scope = memory，该实例重启，其他实例查询|  
|alter session|  
|
|  
|无scope子句|  
|  
|  
|


补充：

并发：

实例1,实例2,实例3分别创建sqlmap，进行查询，映射开关true/false

实例1创建sqlmap和表，实例2查询后将表中数据删除，实例3创建第二个sqlmap并将实例2删除掉的数据作为映射语句，使用后查看表数据

实例1创建两张表和sqlmap，原语句和映射语句insert同一张表并查询，实例2创建sqlmap2，原语句和映射语句insert/delete不同表并查询，实例3原语句和映射语句delete同一张表并查询

实例1创建表及sqlmap后查询，实例2再次查询后将关联的表删除，实例3创建被删掉的关联表

实例1创建表及sqlmap后查询，实例2再次查询后将关联的表重命名，实例3查询原来关联表及重命名后的表的映射结果

  


# **4. 详细设计**

#   
  5.   **测试用例**

  


#   
  6.   **测试框架设计**

本次测试采用regress测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

# 7.   **测试环境说明**

|**服务器**|** **|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments: