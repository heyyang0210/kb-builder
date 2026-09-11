Created by 刘清萍, last modified on 六月 11, 2024

# 1. 概述

sr链接：    [https://pingcode.yasdb.com/pjm/items/66290f05fd997db58ae12907](https://pingcode.yasdb.com/pjm/items/66290f05fd997db58ae12907)    ?    
  #YDBRD-26658 insert on duplicate update支持values(column)功能

开发文档：    [YDBRD-26658：insert on duplicate update支持values(column)功能 设计 - 朱月婷 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=152999853)  

测试调研文档：    [YDBRD-26658 insert on duplicate update支持values(column)功能调研文档 - 刘清萍 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=153013769)  

测试概要文档：    [YDBRD-26658 insert on duplicate update支持values(column)功能 概要设计 - 刘清萍 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=153012713)  

# 2. 需求分析

## 2.1 功能点分析

  本需求的目标是，  *支持insert on duplicate update支持values(column)功能。*

```
drop table t1;
create table t1 (c1 int primary key, c2 int unique, c3 int, c4 int);
insert into t1 values (1,1,1,1);
insert into t1 values (2,2,2,2);
insert into t1 values (3,3,3,3);
insert into t1 values (4,4,4,4);
insert into t1 values (5,5,5,5);
commit;

--更新后违反c2唯一约束
insert into t1(c1,c2,c3) values (1,3,4) on duplicate key update c2=values(c2);
--更新后违反c1主键约束
insert into t1(c1,c2,c3) values (2,7,3) on duplicate key update c1=values(c3);
--不违反约束插入
insert into t1(c1,c2,c3) values (6,6,6) on duplicate key update c1=values(c1),c2=values(c2),c3=values(c3);
select * from t1;
--c1 更新插入
insert into t1(c1,c2,c3) values (1,7,7) on duplicate key update c1=values(c1),c2=values(c2),c3=values(c3);
select * from t1;
--c2 更新插入
insert into t1(c2,c1,c3) values (3,8,8) on duplicate key update c1=values(c1),c2=values(c2),c3=values(c3);
select * from t1;

```

## 2.2 应用场景

- *单机行表*
- *集群行表*


# 3. 详细测试设计

## 3.1 测试设计方法

1.对于  *values(column)*  语法等场景采取场景  覆盖法进行用例设计

2.对于无效等价类采取错误猜测法进行用例设计

3.对比结果和mysql执行结果是否一致,  检查rowcount---------(update后rowcount mysql显示一行 我们统一为一行）

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方*  *式*


|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是|
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


|输入条件|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|
|之前用例复用|  
|  
|  
|  
|
|*values(column)*|values大写、小写、大小写混合|  
|value  *(const)*|insert     into   t1(c1,c2,c3)   values   (  2  ,  2  ,  3  )   on     duplicate     key     update   c1=  values  (c3);|
|  
|value  *(Acalues存在列)*|  
|*values(多列)*|  
|
|  
|value  *(Acalues不存在列)--补null*|  
|*values(subquery)*|  
|
|  
|c1  = values  (c2)+  values  (c2)表达式（加减乘除）|  
|values（基表也不存在列）|  
|
|  
|acalues中有null插入主键（null，1,1）|  
|values(表达式)|  
|
|  
|  
|  
|values（null）|  
|
|  
|  
|  
|数据转换失败 ------类型相关-----c1=values(c2)|  
|
|表约束|无约束 直接插入|  
|  
|  
|
|  
|主键约束  (单个主键，多个主键乱序）|  
|  
|  
|
|  
|唯一约束(  单个唯一约束、多个唯一约束乱序）|  
|  
|  
|
|  
|外键约束|  
|  
|  
|
|  
|非空约束|  
|  
|  
|
|  
|default|  
|  
|  
|
|  
|check约束|  
|  
|  
|
|  
|复合主键|  
|  
|  
|
|update语法|c1=const 组合values混合使用|对同一列进行两次更新|update多列 (  c1,c2)  = (values  (c2),  values  (c2))|  
|
|  
|c1=column  组合values混合使用|  
|  
|  
|
|  
|c1=(subquery) 组合values混合使用|  
|  
|  
|
|  
|（c1,c2)=(const,const)组合values混合使用|  
|  
|  
|
|  
|对同一列进行两次更新c1 = 3,c1=values(c3)|  
|  
|  
|
|  
|  
|  
|  
|  
|
|表类型|普通表|  
|  
|  
|
|  
|分区表（跨分区更新）|  
|  
|  
|
|  
|临时表|  
|  
|  
|
|insert|多值 ----（部分成功 检查报错）|  
|  
|  
|
|  
|乱序 (c3,c1,c2)插入-----多个主键|  
|  
|  
|
|insert相关语法组合测试|  
|  
|  
|  
|
|统计信息|大数据量更新后收集-------统计信息失效|  
|  
|  
|
|绑定参数|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

*机器ip：192.168.18.108*

*操作系统：x86系统*

# 7. 工作量评估

工作量：1周

计划测试完成时间：6.15

  


测试设计评审纪要：

1.补充复合主键

2.统计信息组合测试点    
    
  与会人：刘清萍、朱月婷、李攀、袁芳达    
    
  评审时间：5.22 下午四点    
    
  评审地点：708    
  会议主题：insert on duplicate测设设计评审    
    


评审通过与否：通过

  


## Attachments:

[YDBRD-26658insert on duplicate update支持values(column)功能 冒烟用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkMGRhMWFkOWEzMzExZGM4ZTc0IiwicmVmX2lkIjoiNjczOTZkMGQ3MjgyMDZlZmI5MmYxYTg3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA1NTc4LCJleHAiOjE3ODIzOTE5Nzh9.nzfKRZ6ItUtmnS7EgIuoJMqBidS6yQ-R0YlyUwDfQuU)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
