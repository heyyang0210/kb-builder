Created by 张茜, last modified on 七月 19, 2024

# **1. 概述**

本文描述共享集群子查询支持gv视图  测试设计。

SR：        [https://pingcode.yasdb.com/pjm/items/6611516f579a3edb84d66fd1](https://pingcode.yasdb.com/pjm/items/6611516f579a3edb84d66fd1)    ?    
  #YDBRD-18732 集群跨节点执行支持gv视图出现在子查询中

开发设计文档：    [集群跨节点支持GV视图出现在子查询中 - 秦湫婷 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=159417176)  

# **2. 需求分析**

## **2.1 功能点分析**

该需求主要实现：集群子查询支持gv视图 

## 基本功能特性

  


## **2.2 应用场景**

主要应用于共享集群实现  集群子查询支持gv视图

## **2.3 规格约束**

- 部署形态：集群、主备集群
- 节点个数：4节点


# **3. 详细测试设计**

## **3.1 测试设计方法**

根据特性特点其实主要需要设计gv视图出现在子查询中，因此该测试设计主要从场景法进行测试设计。

1、视图范围：select NAME from V$DYNAMIC_VIEWS where name like '%GV%';

2、子查询出现位置场景

      1）创建对象中出现子查询

      2）dml 、dcl中出现子查询

      3）存储过程、匿名块、事务、触发器、merge、游标

      4）内置函数中出现子查询

      5）子查询嵌套子查询

3、视图关联

      1）join、left join 、right join、union all、union、from a,b、INTERSECT、INTERSECT ALL、  MINUS 、MINUS ALL

      2）gv视图和gv视图、普通表、临时表、视图、同义词、dblink关联查询

4、故障场景覆盖

      1）主要通过testkill工程看护（所有查询和故障随机并发）、网络故障

5、环境形态覆盖：

      1）  单机集群

      2）多机集群

      3）主备集群

测试场景主要有：

|测试对象|测试项|测试描述|详细测试内容|
|:---|:---|:---|:---|
|select NAME from V$DYNAMIC_VIEWS； 所有的gv视图以及同名视图的GV_$开头视图    
    
    
    
    
    
|子查询出现位置场景|1）创建对象中出现子查询,create table as、create temp table as、CREATE OUTLINE、CREATE SYNONYM、CREATE TRIGGER、CREATE VIEW、CREATE MATERIALIZED VIEW、CREATE SQLMAP,2）dml 、dcl中出现子查询,delete、insert、update、with......as、select、explain,3）存储过程、匿名块、事务、触发器、merge、游标,4）内置函数中出现子查询,1. select(select
1. having (select
1. group by (select
1. rollup(select --不支持
1. cube(select --不支持
1. order by(select
1. offset(select
1. row(select
1. 函数结合子查询（max、min、窗口函数等max(select）
,5）子查询嵌套子查询，多层（20层以上，select(select(select）,6)  考虑创建对象之后的使用,比如：create view aa select * from gv$instance，v;  create synonym aa_syn for aa; select * from aa,aa_syn,gv$instance  where i.inst_id = d.inst_id and i.inst_id = 1;,create table aa select * from gv$instance;  create synonym aa_syn for aa;,CREATE OR REPLACE TRIGGER update_order_counter    
  AFTER INSERT ON aa_syn     
  FOR EACH ROW    
  BEGIN    
  update aa set id = 10086 where id=100;    
  END;    
  /|  
    
    
    
  CREATE OR REPLACE TRIGGER update_order_counter    
  AFTER INSERT ON test_YDBRD16973_tb_02    
  FOR EACH ROW    
  BEGIN    
  update test_YDBRD16973_tb_02 set id = 10086 where id=100;    
  END;    
  /|
||视图关联|1、关联方式,join、left join 、right join、union all、union、from a,b、INTERSECT、INTERSECT ALL、MINUS 、MINUS ALL,2、关联对象(可考虑每个字段都关联查询),select * from gv$instance i, gv$database d where i.inst_id = d.inst_id and i.inst_id = 1;,select * from gv$instance i, v$instance d where i.STATUS= d.STATUS and i.inst_id = 1;,select * from gv$instance i, v$instance d where i.STATUS= d.STATUS and i.STARTUP_TIME= d.STARTUP_TIME and i.HOST_NAME= d.HOST_NAME and i.IN_REFORM= d.IN_REFORM and i.inst_id = 1;,gv视图和创建之后的对象，普通表、临时表、视图、同义词、dblink关联查询||
|资料|  
|不支持字眼需要放开||
|并发|  
|所有查询并发执行，testkill工程看护||
|集群部署形态|  
| 1）单机集群, 2）多机集群, 3）主备集群||
|故障|  
|所有查询在testkill工程看护,手动场景：,1、子查询前kill 1个，多个实例（kill -9、断网卡、延迟、丢包）,2、 子查询过程中kill 1个，多个实例（kill -9、断网卡、延迟、丢包）||


## **3.2 详细测试设计**

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是|
|KT|是|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|否|
|压力|否|
|性能|否|
|可维护性|是|


  


# **4. 测试用例**

[YDBRD-18732 集群跨节点执行支持gv视图出现在子查询中.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYWZhMWFkOWEzMzExZGM5MzA0IiwicmVmX2lkIjoiNjczOTZkYWY1OTNmOTljOWZmMjM3ZTc5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwNjk1LCJleHAiOjE3ODIzOTcwOTV9.m4c3OvRF8G64ihUlLqDv0EubwGHedNUL8J02OW-REsE)

# **5. 测试框架设计**

- 如果用例不能实现自动化需要在此标注并说明原因
- 确认使用的测试框架及其满足度


|用例类型|测试框架|用例目录|用例个数|备注|
|:---|:---|:---|:---|:---|
|基本故障业务场景用例|ha|  
|/|  
|
|DB并发启停用例|ha|  
|/|  
|
|公共故障场景用例|dfr|  
|  
|  
|
|长稳用例|regress_rac|  
|  
|  
|
|并发KT用例|testkill|  
|  
|  
|
|一致性KT用例|consistency|  
|  
|  
|
|不可自动化用例|/|  
|  
|  
|


# **6. 测试环境说明**

测试环境：4节点单主机磁阵环境+4节点多主机磁阵环境+主备ha集群

# **7. 工作量评估**

工作量：8人天

计划测试完成时间：2024/7/31

|工作量|备注|
|:---|:---|
|用例输出|  
|
|用例自动化|  
|
|用例测试执行|  
|
|问题单跟踪回归|  
|
|CI工程新增和沟通对齐|  
|
|需求上车|  
|


# **8. TODO**

  


# **9. 上车工程分析**

## Attachments:

[YDBRD-18732 集群跨节点执行支持gv视图出现在子查询中.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYWZhMWFkOWEzMzExZGM5MzA0IiwicmVmX2lkIjoiNjczOTZkYWY1OTNmOTljOWZmMjM3ZTc5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwNjk1LCJleHAiOjE3ODIzOTcwOTV9.m4c3OvRF8G64ihUlLqDv0EubwGHedNUL8J02OW-REsE)

 (application/x-xmind)    


## Comments:

|  [](null)  ,一、会议时间：2024/7/10 周三 10:00-11:00    
  二、会议地点：线上会议    
  三、会议主持人：张茜    
  四、参会人员：冯浩楠、秦湫婷、张茜    
  五、会议主题：集群子查询支持gv视图--测试设计评审,会议纪要：    
  1、需要确认资料中是否存在不支持GV出现在子查询的关键字。    
  2、所有的gv视图以及同名视图的GV_$开头视图,测试设计文档：    
    [https://conf.yasdb.com/pages/viewpage.action?pageId=159424520](https://conf.yasdb.com/pages/viewpage.action?pageId=159424520)  ,Posted by zhangqian at 七月 10, 2024 11:19|
|---|
