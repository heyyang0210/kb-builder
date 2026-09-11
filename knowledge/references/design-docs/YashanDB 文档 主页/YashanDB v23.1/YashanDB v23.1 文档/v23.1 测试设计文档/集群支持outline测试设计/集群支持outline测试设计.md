Created by 李凯峰, last modified on 十一月 08, 2023

# 1.   **概述**

sr:    [YDBRD-15259](https://jira.yasdb.com/browse/YDBRD-15259?src=confmacro)    -  outline的集群化改造  完成

设计文档：    [集群支持outline - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=122074651)  

# 2.   **需求分析**

- outline用于固定sql的执行计划，用于消除环境或者统计信息的影响，集群和单机使用上没有区别
- outline实际是使用hint来固定执行计划的
- outline的信息都记录在系统视图里
- sys.ol$：用来记录对应的SQL语句、hashvalue、outline名称、category名称等
- sys.ol$hints：用来记录 outline 名称、category名称、hint节点内容、相关表名称、join次序等
- sys.ol$nodes：记录语句对应的执行计划层级等信息


# 3.   **测试设计方法**

主要采用的等价类划分，边界值  ，场景法组合及错误推测法进行设计

4.   **详细测试设计**

  


1）

[集群支持outlin.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMDc4OTcwYzJhZjRmNTFmYmE3IiwicmVmX2lkIjoiNjczOTZhMDc1OTNmOTljOWZmMjM1NGYwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNzY2LCJleHAiOjE3ODIyOTcxNjZ9.sGvnn913W29cSLQ8_cTApnjeThDImxGKzbmcGoiF2rA)

|输入条件|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|
|语法测试|1.创建outline：create outline：,or replace,public:目前只支持该模式,outline_name:,from source_outline,for category category_name,on statement：select、delete、insert、insert into select、create table as select,  
,2.查询outline,select outline,  
,3.alter outline ：,public、outline_name、rebuild、  rename to new_outline_name、change category to category_name、enable、disable,  
,4.drop outline,  
|  
|1.创建同名outline,2.alter outline为同名outline,3.alter 不存在的outline|  
|
|结合权限并发（覆盖有权限和无权限的并发）|CREATE ANY OUTLINE,ALTER ANY OUTLINE,DROP ANY OUTLINE|  
|  
|  
|
|实例间并发使用outline|  
,多实例并发创建不同名outline,多实例并发alter outline|  
|多实例并发创建同名outline|  
|
|多实例并发创建outline以及其他数据库同名的对象|  
|  
|  
|  
|
|outline相关视图|sys.ol$  sys.ol$hints    sys.ol$nodes |  
|drop、alter、无权限的用户访问、insert、delete、truncate，为视图新增列，新增索引等|  
|
|特殊场景|停掉一个节点使用outline,KILL|  
|  
|  
|
|explain检查计划是否正确|  
|  
|  
|  
|
|create outline 时指定HINT|  
|  
|  
|  
|
|交付形态：集群|  
|  
|  
|  
|


2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|---|---|
|并发|涉及|
|长稳|不涉及|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR/testkill|涉及|
|HA|不涉及|
|压力|不涉及|
|性能|不涉及|
|可维护性|涉及|


  


  


# 5.   **测试用例**

  


# 6.   **测试框架设计**

1. 使用GUIDER框架即可


# 7.   **测试环境说明**

|服务器类型|os|  
|
|:---|:---|:---|
|vm|centos|单机/集群|


  


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMDdhMWFkOWEzMzExZGM3YTFmIiwicmVmX2lkIjoiNjczOTZhMDc1OTNmOTljOWZmMjM1NGYwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNzY2LCJleHAiOjE3ODIyOTcxNjZ9.18QqQ36ec5JCzVeeAZcg_OVa83hQT6XofjF79nVddH0)

## Attachments:

[SqlLoader导入过程消耗统计信息.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMDc4OTcwYzJhZjRmNTFmYmE4IiwicmVmX2lkIjoiNjczOTZhMDc1OTNmOTljOWZmMjM1NGYwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNzY2LCJleHAiOjE3ODIyOTcxNjZ9.qOJM9SQCiQmd8Vdb1EOXCxr_i5xBPygbAcwC3tvh7l8)

 (application/x-xmind)    


[配置参数打印到run.log日志.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMDg4OTcwYzJhZjRmNTFmYmE5IiwicmVmX2lkIjoiNjczOTZhMDc1OTNmOTljOWZmMjM1NGYwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNzY2LCJleHAiOjE3ODIyOTcxNjZ9.uQVFuwsJ4ZlqDFwE-An1s5HC0nIJNL9ctjiLXSrYG5o)

 (application/x-xmind)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMDg4OTcwYzJhZjRmNTFmYmFhIiwicmVmX2lkIjoiNjczOTZhMDc1OTNmOTljOWZmMjM1NGYwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNzY2LCJleHAiOjE3ODIyOTcxNjZ9.DZZJeZlLWn1ro8K2AYvxdGrGiHWEjaD7S4BWkp4VfUQ)

 (image/svg+xml)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMDdhMWFkOWEzMzExZGM3YTFmIiwicmVmX2lkIjoiNjczOTZhMDc1OTNmOTljOWZmMjM1NGYwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNzY2LCJleHAiOjE3ODIyOTcxNjZ9.18QqQ36ec5JCzVeeAZcg_OVa83hQT6XofjF79nVddH0)

 (application/msword)    


[YDBRD-21634行存支持length2函数.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMDhhMWFkOWEzMzExZGM3YTIwIiwicmVmX2lkIjoiNjczOTZhMDc1OTNmOTljOWZmMjM1NGYwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNzY2LCJleHAiOjE3ODIyOTcxNjZ9.du4JhFIIiMA8w2fWptBn7CDakjkEtNCpa4UnBPuQSnM)

 (application/x-xmind)    


[集群支持outlin.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhMDc4OTcwYzJhZjRmNTFmYmE3IiwicmVmX2lkIjoiNjczOTZhMDc1OTNmOTljOWZmMjM1NGYwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNzY2LCJleHAiOjE3ODIyOTcxNjZ9.sGvnn913W29cSLQ8_cTApnjeThDImxGKzbmcGoiF2rA)

 (application/x-xmind)    
