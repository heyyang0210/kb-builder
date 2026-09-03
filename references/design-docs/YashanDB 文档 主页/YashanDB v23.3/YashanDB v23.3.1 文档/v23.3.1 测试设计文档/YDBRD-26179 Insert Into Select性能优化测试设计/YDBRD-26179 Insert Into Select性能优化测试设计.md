Created by 李攀, last modified by  马文英 on 八月 16, 2024

##   [1. ](https://conf.yasdb.com/pages/viewpage.action?pageId=153021088#1-%E6%80%BB%E8%BF%B0)    概述

  


本文描述 通过批量执行实现 Insert Into Select性能优化测试设计设计。

IR链接：：    [https://pingcode.yasdb.com/ship/ideas/6614fdba009f91eb87f32f4d](https://pingcode.yasdb.com/ship/ideas/6614fdba009f91eb87f32f4d)    ?#YASHAN-2817 INSERT_INTO_SELECT性能优化

*SR链接：*  ：    [https://pingcode.yasdb.com/pjm/items/6618e9bdfd997db58ad832cd](https://pingcode.yasdb.com/pjm/items/6618e9bdfd997db58ad832cd)    ?#YDBRD-26179 INSERT_INTO_SELECT性能优化

开发设计文档：    [YDBRD-26179 Insert Into Select性能优化设计文档 - 陈楚坤 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=162993931)  

# 2. 需求分析

## 2.1 功能点分析

基于批量执行框架，实现批量insert into select算子。 目标是select部分能够通过批量执行进行加速，已提升insert into select的性能。

                          insert into 查询走批量的语句的性能要明显优于单行执行。

## 2.2 应用场景

- ***单机行存，集群***


- insert into select  语句，select 语句必须符合批量执行支持的算子，含有批量执行不支持的算子则用不到select部分的加速，性能不会提升


  


### 2.3    [ 批量插入](https://conf.yasdb.com/pages/viewpage.action?pageId=162993931#41-%E6%89%B9%E9%87%8F%E6%8F%92%E5%85%A5)  

批量insert into select的关键是要让select能够批量执行，在此基础上，实现将批量select的结果批量的插入到目标表中。对于第一个问题只需在批量执行引擎中支持insert into select算子，然后对select调用已有的open和batchFetch接口即可。对于第二个问题单行执行已经实现了批量插入接口(ankBatchInsert)，批量执行只需按接口的要求准备好数据，然后调用ankBatchInsert即可实现批量插入。

select返回的数据按DataChunk组织，ankBatchInsert接口要求输入数据为Compact Row，为此需要将DataChunk转换为Compact Row。执行流程如下：

- 1.初始化批量插入缓冲区，缓冲区大小为128KB，当行数据大小超过64KB时，将调用ankBatchInsert执行批量插入。
- 2.初始化rowSize和colSize数组。
- 3.遍历DataChunk，执行ColSize流程，批量的生成rowSize和colSize数组，rowSize表示每行数据编码为Compact Row后的大小，colSize表示每行每列数据的大小。用于辅助生成Compact Row。
- 4.根据RowSize初始化RowManager，将每个RowManager指向缓冲区的一个区域。
- 5.遍历DataChunk，执行Scatter流程，批量的将DataChunk的数据通过RowManager写入到缓冲区中。当遍历到行数据的总大小超过64KB时，执行ankBatchInsert批量插入数据。然后重复以上流程继续插入。


## 2.4 规格约束

- 1.只支持普通非分区heap表，不支持多表插入。-----后续适配时间？
- 2.不支持UDT类型
- 3.不支持ON DUPLICATE KEY UPDATE。
- 4.select子句必须只包含当前批量执行支持的算子、表达式，否则不走批量执行。
- insert表含有触发器支持  


# 3. 详细测试设计

## 3.1 测试设计方法

主要采取场景构造法，等价类划分法设计测试用例 查看计划和结果是否正确，现有单机insert into select 用例加开启批量执行对比和主干的的计划、结果

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点*


  


|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|:---|
|语法|insert into table select  ,insert into table(c1,c2..) select  |  
|  
|insert into select ..ON DUPLICATE KEY UPDATE|不支持,不走批量|
|  
|insert into table t1 partion(p1)  |  
|这次交付不支持，不走批量|  
|  
|
|  
|insert all into|  
|  
|多表插入|不支持|
|  
|权限控制|insert into table user1.t1 select * from user2.t2 |  
|  
|  
|
|  
|  
|  
|当前用户拥有足够的权限访问源表和目标表才能正常执行|没有访问权限|不支持，报错|
|  
|数据类型|char，varchar|  
|udt|不支持，报错|
|  
|  
|tinyint，smallint，int，bigint|  
|  
|  
|
|  
|  
|number|  
|  
|  
|
|  
|  
|float，double|  
|  
|  
|
|  
|  
|time，timestamp，date|  
|  
|  
|
|  
|  
|clob，blob,nclob|32000大小限制 |  
|  
|
|  
|  
|inrow 模式存储的lob,outlow模式存储的lob|实际长度<=  3988字节,实际长度>3988字节,超大lob >32000字节，500MB|  
|  
|
|  
|  
|json|  
|  
|  
|
|  
|  
|boolean|  
|  
|  
|
|  
|  
|bit|  
|  
|  
|
|  
|  
|xmtype,raw，rowid|  
|  
|  
|
|  
|数据类型转换|隐式类型转换|同种数据类型的精度不同：char(20)往char(1)插入,预期报错,  
|  
|  
|
|  
|  
|不同类型插入越界的情况|如 超过int类型最大值的bigint 往int插入|  
|  
|
|  
|  
|强制类型转换|cast转换   select cast( c1 as date),特别注意null值得转换 null as date null as varchar等|  
|  
|
|  
|时间日期类型修改date_format插入|  
|  
|  
|  
|
|投影列|投影列数量|待插入的表列等于select投影列个数|  
|  
|  
|
|  
|  
|待插入表的列大于select投影列个数|投影列可以有null值，补null|  
|  
|
|  
|  
|待插入表的列小于投影列个数|报错|  
|  
|
|  
|  
|4096列|2048|  
|  
|
|  
|投影列类型|单列|  
|  
|  
|
|  
|  
|表达式列，函数列，普通函数，聚集函数，窗口函数|批量执行不支持得表达式不会走批量计划,重点关注一下clob列的字符串函数如substr|  
|  
|
|  
|  
|伪列rownum ， rowid ，rowscn|不走批量计划|rowid支持批量|  
|
|  
|  
|投影列带子查询|不走批量计划|  
|  
|
|  
|  
|sysdate，systimestamp，random|  
|  
|  
|
|  
|表约束|not null|单列约束，多列约束|  
|  
|
|  
|  
|check|  
|往目标表插入不符合check约束的数据会报错。|  
|
|  
|  
|unique|  
|  
|  
|
|  
|  
|主键|  
|  
|  
|
|  
|  
|外键|  
|  
|  
|
|  
|  
|default,覆盖每一种数据类型|lob列条件默认值，,col2 clob default lpad('中国',2600,'加油'))"|表上的default值是sequence，不走批量，default值是其他表达式，覆盖下批量不支持和支持的函数等|  
|
|  
|  
|列上含有普通索引|  
|  
|  
|
|  
|  
|有触发器|细化下触发器类型|  
|  
|
|select语句|支持批量的算子组合|table scan|  
|  
|  
|
|  
|  
|聚集函函数和表达式|  
|  
|  
|
|  
|  
|order by |  
|  
|  
|
|  
|  
|hash group|  
|  
|  
|
|  
|  
|hash join|  
|  
|  
|
|  
|  
|以上算子组合|  
|  
|  
|
|  
|查询filter|like，rlike，not like，not rlike|  
|  
|  
|
|  
|  
|between and|  
|  
|  
|
|  
|  
|is null， is not null|  
|  
|  
|
|  
|  
|any，all，some|  
|子查询|  
|
|  
|  
|in|多列，单列,in list|in subquery|  
|
|  
|  
|  
|  
|  
|  
|
|  
|插入表类型|heap 表|heap往列 |列表往heap表插入|报错|
|  
|  
|view,覆盖源表和目标表是view的场景|create view v1 as select * from t1;  ,insert into t1 select * from v1;,insert into v1 select * from t1;|  
|  
|
|  
|  
|插入表是系统表|  
|  
|  
|
|  
|  
|分区表：,分区表往普通表里插入,普通表往分区表里插入|这个SR不支持|  
|  
|
|  
|数据特征|insert表的数据和select表的数据分布是否一致|不测|  
|  
|
|  
|  
|大量数据|大量插入时验证下性能和dev主干对比,分段commit;|  
|  
|
|  
|  
|插入大量的重复数据|  
|  
|  
|
|  
|  
|select 数据全是null |1行，1w行null|  
|  
|
|  
|  
|select 的数是有序的，插入目标表后数据分布是否有序|不重点关注，目标表是否有序不能保证|  
|  
|
|  
|  
|select查询的行数据量<64k =64k >64k,  
|  
|  
|  
|
|  
|开启insert into 并行 重点关注一下，批量合入23.3后有|insert并行：,insert /  *+ parallel(t1,4)*  / into select|预期是：不走批量计划    
    
|  
|  
|
|  
|  
|insert 不并行，select 并行：,insert     into   t1   select     /*+ parallel(t2,4)*/   *   from   t2 ;|预期是：不走批量计划|  
|  
|
|  
|  
|insert并行+select并行：,insert     /*+ parallel(t1,4)*/     into   t1   select     /*+ parallel(t2,4)*/   *   from   t2 ;|预期是：不走批量计划|  
|  
|
|  
|统计信息|插入前，收集目标表统计信息，insert 后收集查看统计信息是否失效|  
|  
|  
|
|  
|  
|插入数据后收集统计信息|  
|  
|  
|
|  
|  
|插入数据后执行DDL语法|*插入前更改DDL，增删改列|  
|  
|
|  
|  
|关注一下中间报错回滚|  
|  
|  
|


DFX功能测试点

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是，开启batch后，insert into select语句并发执行|
|KT|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|否|
|压力|否|
|可维护性|  
|
|性能|验证批量和非批量场景性能对比|
|覆盖率-----开发|  
|


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


文本用例：

# 5. 测试框架设计

不涉及

# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

*机器ip：192.168.4.115*

*操作系统：x86系统*

# 7. 工作量评估

工作量：

计划测试完成时间：8.22

  


测试设计评审纪要    
    
  与会人：李攀，唐嘉欣，马文英，陈楚坤    
    
  评审时间：2024.8.14    
    
  评审地点：702会议室    
    
  评审纪要信息：

lob类型重点测试一下，各个长度的lob

绑定参数

  


                         

                         

  
  评审通过与否：

  
