Created by 许秋莹, last modified by  刘清萍 on 四月 16, 2024

# 1. 概述

当前，对于viewScan内部存在rank函数，并且viewScan有rank函数结果的过滤的情景，并没有做filter相关的下推。这个特性设计将把filter下推成topN值，挂在windowFunc上，并且仍然保留filter将在viewScan。

调研文档：    [YDBRD-23933 分布式支持 partition TopN 调研文档 - 刘晓旋 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=138575729)  

概要设计：    [YDBRD-23933 分布式支持 partition Top 概要设计 - 刘晓旋 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=141557969)  

# 2. 需求分析

## 2.1 功能点分析

- 性能优化：  将过滤条件应用于窗口函数，可以在数据库内部执行，减少了从数据库中检索大量数据的开销，并且可以减少数据传输到客户端的需要
- 不影响原本的语法语义
- 支持的过滤条件：  Filter下推应该支持常见的过滤条件，如等值条件、范围条件、逻辑条件等；还应该支持对窗口函数的不同部分（如PARTITION BY、ORDER BY）应用不同的过滤条件


## 2.2 应用场景

- 大数据集过滤：当查询需要对大型数据集进行窗口函数计算，并且外部查询包含过滤条件时，可以通过将过滤条件下推到窗口函数，减少计算的数据量，提高性能
- 复杂分析操作：对于涉及复杂分析操作的查询，如分区、排序、排名等，通过将过滤条件下推到窗口函数，可以在处理大量数据时提高查询效率
- 优化窗口函数性能：通过将过滤条件下推到窗口函数，可以在窗口函数计算之前对数据进行过滤，减少计算所需的资源消耗，从而优化窗口函数的性能


## 2.3 规格约束

- 当前特性仅将filter的信息挂载到window func上，实际仍然还未实现相应执行功能，后续将在     YDBRD-23933     -     增加partition topN功能     开发中     中实现
- 仅支持rank()函数
- 此外，本特性仅实现一个较为简单的场景：只有在view内只包括单个和窗口函数相关的filter或者and连接的filter，且filter类型只能是小于或者等于const，窗口函数相关的filter要对应上内部的窗口函数；对于or连接起来的窗口函数过滤条件，是不可以下推的。


# 3. 详细测试设计

## 3.1 测试设计方法

*本测试设计主要采用等价类划分法，其中的第七部分，采用场景法进行测试。*

## 3.2 详细测试设计

#### DFX测试

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|  
|
|KT|  
|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR|  
|
|HA|  
|
|压力|  
|
|性能|Y|
|可维护性|  
|


#### 3.2.1  表测试数据

|应包含数据|备注|
|---|---|
|NULL|  
|
|重复值|  
|
|非重复值|  
|
|特殊字符|  
|
|表情符号|  
|
|中文|  
|
|英文|  
|


#### 3.2.2  filter类型覆盖

|filter|备注|
|---|---|
|比较谓词：,=、<、>、<=、 >= 、<>|仅 <, <=，=下推|
|逻辑谓词：,and 、or、 not|  
|
|范围谓词：,between ...and|  
|
|空值谓词：,is null, is not null|  
|
|模式匹配谓词：,like |  
|
|in / exists subquery,- where winfunc () in (select c1 from )
|  
|
|any / all / some subquery,- winfunc = all （select c1 from ）
|  
|
|case when|  
|


#### 3.2.3  filter所在位置

|位置|备注|
|---|---|
|where|  
|
|having|   having后和rank比较 是否下推；    
  组合limit查看下推结果    
|
|join on,- inner join
- full join
- left join
- right join
- t1,t2 where
|  
|


#### 3.2.4  filter条件值覆盖

|等价类|备注|
|---|---|
|常量|  
|
|函数|  
|
|表达式|  
|
|普通子查询|  
|
|join子查询|  
|
|集合子查询|  
|
|可隐式转换列|数据类型全覆盖|
|ROWNUM、ROWID|  
|


#### 3.2.5  filter查询表类型

|表类型|备注|
|---|---|
|普通表|  
|
|分区表|  
|
|分布表|  
|
|复制表|  
|


#### 3.2.6 filter条件个数

|数量|备注|
|---|---|
|单个|  
|
|多个|  
|
|512个|  
|
|边界值|？|


#### 3.2.7 filter条件和其他条件组合

|条件|备注|
|---|---|
|仅包含rank窗口列的filter条件|别的测试点已覆盖|
|rank窗口列 + 其他可下推的数据类型|别的测试点已覆盖|
|rank窗口列 + 其他不可下推的数据类型|别的测试点已覆盖|
|可下推的 rank 窗口列的 filter 条件和不可下推的 rank 窗口列的 filter 条件组合|sysdate()、random()、sequence和rank列比较|
|关注有无order by、有无partition by|  
|
|谓词两边的位置互换|rank 窗口函数列在左|
|  
|rank 窗口函数列在右|
|支持param  增加绑定参数测试点（使用jdbc查看计划）|  
|


  


#### 3.2.8 投影列个数

|数量|备注|
|---|---|
|单个|  
|
|多个|  
|
|512|  
|


#### 3.2.9 投影列包含类型

|类型|备注|
|---|---|
|rank窗口函数|  
|
|非 rank 的其他窗口函数|  
|
|聚集函数|  
|
|普通函数|  
|
|表达式|  
|
|普通列|  
|
|常量|  
|
|NULL|  
|


####   
  3.2.10 子查询

|类型|备注|
|---|---|
|多层子查询嵌套|多层嵌套查看遍历结果是否正确|
|join子查询|多表混合|
|集合查询|多表混合|
|外部引用关注拦截|  
|


#### 整体作为子查询出现位置

|场景|  
|
|---|---|
|cte|  
|
|insert、delete、update|  
|
|in/exists|  
|
|any、all、some|  
|
|having|  
|
|select 后面子查询|  
|
|组合外部引用|  
|


#### 3.2.11   filter 列为其他窗口函数的列（关注结果是否正确，预期不下推）

|等价类|备注|
|---|---|
|覆盖其他窗口函数    
  sum/avg/count/min/max/listagg/first_value/last_value/median/lag/lead/dense_rank/row_number|  
|


####   
  3.2.12 order by键列类型

|等价类|备注|
|:---|:---|
|子查询,- 关联子查询
- 非关联子查询
|  
|
|常量|  
|
|普通列：,- 单列
- 多列
- 列表达式: c1 + c2, c1 + 1, abs(c1)
- sysdate, user
- 伪列：rownum，rowid（关注结果是不是稳定）
- 外部引用列
- 其他函数列：udf，dbms_random, 窗口函数
- 列数据类型：blob, clob, nclob, nchar, nvarchar, xmltype, json
- 非分区键列
- 一级分区键列
- 二级分区键列
- 分布键列
|  
|
|聚集函数|  
|


  


### 3.2.13 以上场景并行执行

###   
  3.2.14 查询计划的正确性（*）

  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- 本次测试采用yasft测试框架实现，执行sql文件，对比期望结果和实际输出结果，输出测试结果


# 6. 测试环境说明

|机器|内存|版本|数据库|
|:---|:---|:---|:---|
|192.168.18.85|31G|CentOS Linux release 7.9.2009 (Core)|开发提供安装包|


# 7. 工作量评估

工作量：7  *人天*

计划测试完成时间：2024/4/17

  


会议纪要：

与会人：许秋莹、孔珂煜、刘清萍、王泽凯、陈关羽、林博、赖美全

会议时间：2024/04/08 16:00-16:42

会议地点：25座708 

  
  纪要信息：

  
  1.关注not a > 3、case when语法

2.增加filter in、exist、any、all、some

3.关注 sysdate()、random()、sequence和rank列比较

4. having后和rank比较 是否下推

5.组合limit查看下推结果

6.多层嵌套查看遍历结果是否正确

7.支持param  增加绑定参数测试点（使用jdbc查看计划）

8.外部引用关注拦截

9.数据量大小可能会影响计划选择

10.关注有无order by、有无partition by

11.只支持列表 分布式单机（集群不支持列表）

  


评审通过与否：通过

  


  
