Created by 王莹, last modified on 十月 21, 2024

# 1. 概述

SR：    [https://pingcode.yasdb.com/pjm/items/67073587e489dd0868f348af](https://pingcode.yasdb.com/pjm/items/67073587e489dd0868f348af)    ?    
  #YDBRD-33734 distinct 投影优化

本需求针对的场景为： 在distinct 投影中，含有重复出现的表达式，通过优化减少重复表达式的计算次数

交付形态：单机，分布式，集群

开发设计文档：  [https://pingcode.yasdb.com/wiki/spaces/ZHUYUETING/pages/67396ca0593f99c9ff23710b](https://pingcode.yasdb.com/wiki/spaces/ZHUYUETING/pages/67396ca0593f99c9ff23710b)  

# 2. 需求分析

## 2.1 功能点分析

不涉及新增功能

## 2.2 应用场景

  


在distinct投影列中，投影个数较大，其中投影列存在表达式包含内置函数、case when等，含有重复出现的表达式的场景下，支持对相同表达式去重

针对优化点的增补场景

  


# 3. 详细测试设计

## 3.1 测试设计方法

AB测试法，使用同样数据和SQL，对比崖山优化前后的性能数据，性能提升  目标

## 3.2 详细测试设计

大数据量：百万级

  


|测试场景|  
|  
|  
|
|---|---|---|---|
|多个case when|case    
  when c1+c2 >c3 then func1    
  when c1+c2 >c3 then func1    
  when c1+c2 >c3 then func1    
  when c1+c2 >c3 then func1    
  when c1+c2 >c3 then func1    
  ....    
  end ,  
|case when条件相同 then相同|  
|
|  
|case    
  when c1>c3 then func1    
  when c1=c2 then func1    
  when c1<c4 then func1    
  when c5=c6 then func1    
  ....    
  end |case 条件不同 when相同，func 类型：,1. 普通函数；
1. 返回结果为lob类型的函数，如
1. TRIM，RTRIM  ， LTRIM    
1. SUBSTRING，SUBSTR
|  
|
|  
|case    
  when func1=func2 then c1    
  when func1=func2 then c2,......    
  when func3=func4 then c3    
  when func3=func4 then c4    
  ....    
  end |  
|  
|
|  
|  
|  
|  
|
|+-*/|c1+c2, func1(c1+c2)，func2(c1+c2)，func3(c1+c2),,c1-c2,func1(c1-c2),func2(c1-c2),func3(c1-c2),,c1*c2,func1(c1*c2),func2(c1*c2),func3(c1*c2),c1/c2,func1(c1/c2),func2(c1/c2),func3(c1/c2)|  
|  
|
|长字符串|c1||c1||c1||c1||c1, concat(c1||c1||c1||c1||c1,c1||c1||c1||c1||c1)|c1 char(8k)   nchar(8k),  
|varchar 转lob类型的场景|
|lob类型|case     
  when DBMS_LOB.COMPARE(C1, C2) =1 then func1    
  when DBMS_LOB.COMPARE(C1, C2) =-1 then func1    
  when DBMS_LOB.COMPARE(C1, C2) =0 then func1    
  when DBMS_LOB.COMPARE(C1, C2) is null then func1,end |入参为clob,blob,nclob,小于32K,大于32k|待确定|
|绑定参数？不涉及|  
|  
|  
|


专项：

涉及性能测试

# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件 

# 5. 测试框架设计

YTP

# 6. 测试环境说明

VM  CentOS Linux release 7.9.2009  3.10.0-1160.el7.x86_64  

CPU GenuineIntel  Intel(R) Xeon(R) Gold 6230R CPU @ 2.10GHz

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

## Comments:

|  [](null)  ,看护场景：无优化、2倍、5倍、劣化（+-*/、缓存成本高）、客户场景；,sql构造：表达式个数、表达式复杂度、表达式的来源如join、from子查询的投影；,  
,Posted by wangying at 十月 21, 2024 11:23|
|---|


