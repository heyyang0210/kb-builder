Created by 孟麟 on 六月 20, 2024

# 1. 概述

  [https://pingcode.yasdb.com/pjm/items/6618efd0fd997db58ad848db](https://pingcode.yasdb.com/pjm/items/6618efd0fd997db58ad848db)    ?    
  #YDBRD-26191 支持启动mysql服务

需求描述：    
  支持在YashanDB服务进程中启动MySQL兼容服务（Plugin Service模式）    
       
  需要范围：    
  1 启动MySQL监听服务    
  2 允许MySQL协议连接数据库    
  3 数据库shutdown时，可正常关闭mysql兼容服务

# 2. 需求分析

## 2.1 功能点分析

1、pulgin service，mysql服务以插件方式运行在yasdb主进程，启动实例时，读取  plug-in/service/service.ini配置文件，加载二进制库，启动插件服务。关闭实例时，也关闭插件服务，详细流程如下：

![](https://conf.yasdb.com/download/attachments/150626329/plugin_service_regsiter.png?version=1&modificationDate=1713864941977&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzE0MjAsImV4cCI6MTc4MjM4MjIyMH0.3FJK3azq7WhT1ghbwUCiK0cBaXdUIDc0UwOgj4cnT_w)

2、service.ini文件

每行配置一个服务（目前只支持mysql服务），格式为：SERVICE1 = {library = yas_my, name = mysql, args = "URL=127.0.0.1:1279"}

规格如下：

- 必须以SERVICE开头，后面紧跟一个数字，表示服务的编号（从1开始）。当前最多支持8个服务，因此数字不能超过8
- library为提供服务的二进制库名称，不需要加lib前缀和.so后缀
- name为服务名称，最大支持64字节，暂无意义
- args为每个服务独有的参数，最大支持4096字节。


3、sql兼容模式

参数名：COMPAT_VECTOR

取值范围：YASHAN（或ORACLE）、MYSQL

默认值：由连接协议决定，YashanDB协议连接时，默认值为YASHAN；MySQL协议连接时，默认值为MYSQL

作用范围：会话

修改命令：    `alter session set compat_vector=mysql;`  

## 2.2 应用场景

- mysql兼容性业务


## 2.3 规格约束

- 最多支持8个服务
- name为服务名称，最大支持64字节，暂无意义
- args为每个服务独有的参数，最大支持4096字节


# 3. 详细测试设计

## 3.1 测试设计方法

service.ini配置和服务启动退出：边界值、等价类和场景分析

## 3.2 详细测试设计

1. 功能测试设计
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|测试对象|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|---|
|插件服务|服务数量|  
|0（没有配置文件，有配置文件没有内容）、1、8|1、多个服务：当前只支持mysql，可配置相同mysql服务来测试,2、服务成功启动验证：1）pstack观察yasdb进程中线程变化；2）使用mysql客户端连接服务|9|配置文件内容错误，  **预期是什么——无法启动，保证整个配置文件的正确性**|
|  
|服务配置,SERVICE1 = {library = yas_my, name = mysql, args = "URL=127.0.0.1:1279"}|SERVICE1|SERVICE1~SERVICE8=,service1~service8=（小写，大小写混合）,多个不按顺序编号（顺序无关）|  
|错误格式（缺失，非‘SERVICE=’开始）,SERVICE9/SERVICE0,重复配置项,空行/空格行|  
|
|  
|  
|library = yas_my|library = yas_my（大小写及混合）,多个library配置项|  
|错误格式（缺失，library=空，缺少=号，非‘library=‘开始）,库不存在（错误文件名，带.so）,库文件异常（非so文件）|  
|
|  
|  
|name = mysql|名称长度：1、64,名称内容：数字、字母、特殊字符、汉字|汉字占3个字节（按UTF8编码计算的）|错误格式（name=空，缺少=号，非‘name=‘开始）,缺失(整体不配置),名称长度0、65,多个name配置项|  
|
|  
|  
|args = "xxx"  **（可选项，mysql插件必选）**|参数长度0、4096,mysql参数URL=ip:port，  **必选**,mysql参数  PACKET_SIZE，可选，范围  **64K~32M，整数（字节），可以带单位，超过范围内部会设置成正确的值**|  
|错误格式（缺失，非‘args=‘开始）,参数长度大于4096,mysql参数URL：缺失，错误格式，错误的ip和端口,mysql参数  PACKET_SIZE：缺失，错误格式，非整数（小数，负数，0，超大（内部范围：max 32M），字母等非数字）|错误的ip和端口：启动报错,PACKET_SIZE：支持后续的需求|
|COMPAT_VECTOR配置项|参数范围|  
|session,  `alter session set compat_vector=mysql;`  |  
|system,  `alter system set compat_vector=mysql;`  |  
|
|  
|取值|默认|yasql连上为YASHAN,mysql连上为MYSQL|  
|/|  
|
|  
|  
|设置|YASHAN（别名  ORACLE）  、MYSQL（大小写及混合）,切换（默认mysql->yashan->mysql，默认yashan->mysql→yashan）,客户端1、2、3链接同一插件服务，客户端1修改，客户端1/2/3分别查询|  
|PG、SQLServer、my_sql，空值|  
|


|系统级DFX分类|是否涉及|
|:---|:---|
|CT|否|
|KT|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|否|
|压力|否|
|性能|否|
|可维护性|否|


  


# 4. 测试用例

1. 冒烟用例：配置mysql插件，可启动可连接；配置错误，报错清晰符合预期
1. 文本用例：


# 5. 测试框架设计

- 后续测试框架需要支持mysql客户端执行sql
- 本需求用例先手工执行，后续考虑自动化


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：3  *人天*

计划测试完成时间：5.9

## Attachments:

[测试用例和执行过程.docx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTZhMWFkOWEzMzExZGM5NmQyIiwicmVmX2lkIjoiNjczOTZlNTY3MjgyMDZlZmI5MmYyNzZhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxNDIwLCJleHAiOjE3ODI0NTc4MjB9.6QV6iCYLLQNN3jh7b4e_QIXwXSj9KeKbbFSlPBNQC1E)

 (application/vnd.openxmlformats-officedocument.wordprocessingml.document)    
