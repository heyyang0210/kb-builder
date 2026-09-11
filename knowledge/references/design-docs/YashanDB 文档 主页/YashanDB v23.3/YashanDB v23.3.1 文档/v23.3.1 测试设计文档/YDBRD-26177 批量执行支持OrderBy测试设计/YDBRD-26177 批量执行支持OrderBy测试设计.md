Created by 李攀, last modified on 七月 23, 2024

##   [1. ](https://conf.yasdb.com/pages/viewpage.action?pageId=153021088#1-%E6%80%BB%E8%BF%B0)    概述

  


本文描述 通过批量执行实现order by性能优化测试设计。

*IR链接：*  ：    [https://pingcode.yasdb.com/ship/ideas/6614fda5009f91eb87f32f40](https://pingcode.yasdb.com/ship/ideas/6614fda5009f91eb87f32f40)    ?#YASHAN-2816 OrderBy性能优化

*SR链接：*  ：    [https://pingcode.yasdb.com/pjm/items/6618e8bafd997db58ad83034](https://pingcode.yasdb.com/pjm/items/6618e8bafd997db58ad83034)    ?#YDBRD-26177 OrderBy性能优化

开发设计文档：    [YDBRD-26177 OrderBy性能优化设计文档 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=159420066)  

# 2. 需求分析

## 2.1 功能点分析

在行存批量全表扫描的基础上，实现  Order By  的批量执行。整体目标：

                           Order by语句的性能要明显优于单行执行。

## 2.2 应用场景

- ***单机行存***


- order by sql语句：order by c1 asc/desc nulls first/last, c2 asc/desc nulls first/last
- top n sql语句：order by c1 asc/desc nulls first/last, c2 asc/desc nulls first/last limit 10


  


## 2.3 规格约束

- 批量执行物化区的页面通过PQ_POOL分配，页面大小为256KB，能使用的最大内存大小为PQ_POOL_SIZE的80%，可通过配置项_PQ_POOL_SIZE进行调整。
- 由于optmzr->owner一个内存块只有16KB，order by排序键最多2048个。
- 快排不稳定


# 3. 详细测试设计

## 3.1 测试设计方法

主要采取场景构造法，等价类划分法设计测试用例 查看计划和结果是否正确

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点*


  


|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|:---|---|:---|:---|:---|:---|
|order key列类型|列名|列名，,列别名,  
|  
|  
|--现有用例已覆盖|
|  
|常量number|1,2,3|  
|列对应的number不存在,如只有3列 order by 4|--现有用例已覆盖|
|  
|函数|内置函数覆盖,聚集函数,窗口函数|投影列没有聚集函数，order 列是聚集函数报错|null，,''|新增一些内置函数，,聚集函数,窗口函数的用例|
|  
|表达式|基于列的运算c1+1,常量表达式 1+1,order by c1-c2，c1+c2 ,c1*c2,其他组合构成的复杂表达式|  
|布尔表达式|报错|
|order key列数|单表单列|  
,  
|  
|  
|  
|
|  
|多列|c1,c2,c3,c1,aggr(c1),aggr (distinct c1),数字和列名表达式组合：|  
,  
,order by c1,c2+1，abs(c2),3|  
|  
|
|  
|极限值|order by的列数是2048列|  
|>2048列，报错|  
|
|  
|多表单列|  
|  
|  
|  
|
|  
|多表多列|2张表2列,3表3列,3表 128列，,128张表join ,order by 列数量是128列|多表连接只支持hash join|  
|  
|
|order key列的数据类型|  
|覆盖yashandb的每一种数据类型,udt类型|  
|  
|补udt用例|
|  
|  
|覆盖定长类型的数据长度，如char 8000,nchar4000|  
|  
|  
|
|  
|  
|不定长类型数据和定长类型结合|vachar,char int timestamp等结合|lob|报错|
|排序算法|插入排序|定长类型，行数小于等于24行|大于24行，不走插入排序,非定长数据类型，如char,不走插入排序|  
|  
|
|  
|快排|大于24 ，边长|  
|  
|  
|
|  
|####   [基数排序](https://conf.yasdb.com/pages/viewpage.action?pageId=159420066#422-%E5%9F%BA%E6%95%B0%E6%8E%92%E5%BA%8F)  |定长，排序键size小于等于5字节，  LSD|布尔，small int,tint|  
|  
|
|  
|  
|定长，大于5 MSD|  
|  
|  
|
|  
|*数据分布|数据本身有序,无序,本身 升序  降序|  
|  
|  
|
|物化区换入换出|  
|order by超大数据量，涉及物化区换入换出varchar 32000，char 8000，nchar 4000组合字符插满，行数100w,10W|  
|  
|  
|
|  
|  
|int,size小的类型，数据量大，如日期类型|  
|  
|  
|
|投影列和order 列的关系|  
|投影列中没有order by的列,投影列和order by列完全相同,投影列是表达式 order 列是列名,投影列和order 列都是表达式且完全相同,投影列和order 列都是表达式不完全相同,投影列有聚集函数，order by也有聚集函数,  
,  
|  
|投影列没有聚集函数，order by也有聚集函数|报错|
|order by数据量|  
|order by的行数量较少：,  0行,  1行,   100行|  
|  
|  
|
|  
|  
|order by的数量很多：, 1000条数据，1亿数据|  
|  
|  
|
|  
|  
|order 列的distinct值较多|  
|  
|  
|
|  
|  
|不同数据类型数据乱序插入|  
|  
|  
|
|  
|  
|不同数据类型数据乱序插入，数据包含NULL值，nulll值较多|  
|  
|  
|
|  
|  
|数据不含nulll值|  
|  
|  
|
|  
|  
|order 列单行的size较大，比如char(8000)|  
|  
|  
|
|  
|  
|varchar 8000和大于8000情况|  
|  
|  
|
|order by方式|  
|desc,asc|  
|  
|  
|
|  
|  
|null first和null last|  
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
|含有filter条件|  
|filter条件 = >,<,<=，>=,!=,filter条件 like,not like,rlike,not rlike， in|  
|  
|  
|
|和其他支持批量的算子组合|  
|和聚集函数，内置函数组合,和group by组合,hash join 带 order by,含有limit,多种组合|group by c1,c2 order by 1,2 limit 10|不支持算走，并行，distinct, view等|不走批量|
|limit|  
|limit +order by|支持批量|limit 不含order by|不支持不是TOP-N|
|  
|  
|limit 不含order by|不支持走批量|  
|  
|
|  
|  
|limit 0 的情况,limit 数量>返回的行数|  
|limit n  n <0,  
|  
|
|  
|top n|limit n off set m,limit n,m的形式,覆盖一下n 和m的关系|3个参数limit 2,3,4|n不是number，报错|  
|
|  
|  
|limit 数量|  
|  
|  
|
|  
|  
|和order by的升降序结合|  
|  
|  
|
|  
|  
|n,m使用绑定参数方式|  
|  
|  
|
|表类型|  
|普通表|  
|分区表|不支持part scan|
|伪列|  
|rownum,rowid,user,urowid,connect by中的伪列|不支持|  
|  
|
|开启并行|  
|  
|不支持,不走批量，生成不了批量计划|  
|  
|
|  
|  
|开启并行，不走并行的计划，还是会走批量|  
|  
|  
|
|PL SQL 中|  
|fetch|  
|  
|  
|
|改变批量执行size,_batch_size|  
|  
|对于性能没有啥影响|  
|  
|
|number类型的浮动精度问题|  
|number(3)|  
|  
|  
|
|order by列涉及类型转换|  
|如to_char,to_number，date函数，cast函数|  
|  
|  
|
|字符集|  
|  
|  
|  
|  
|
|有索引|  
|  
|不支持,不走批量|  
|  
|


DFX功能测试点

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是，开启batch后，查询语句并发执行|
|KT|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|否|
|压力|否|
|性能------对比master----赵育的工程--------jdbc|是，和dev没有开启批量执行性能对比，补一下定长不定长|
|可维护性|  
|
|建立复制工程|  
|
|覆盖率-----开发|  
|


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


文本用例：

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*
- *使用c/oci对应git仓库里的CUNIT框架，c驱动已使用HA部署*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

*机器ip：192.168.18.108*

*操作系统：x86系统*

# 7. 工作量评估

工作量：

计划测试完成时间：

  


测试设计评审纪要    
    
  与会人：李攀，唐嘉欣，马文英    
    
  评审时间：2024.7.15    
    
  评审地点：702会议室    
    
  评审纪要信息：

重点关注数据分布

隐藏参数充分测试，异常情况

性能要比非批量快

补充排序算法覆盖和数据分布的用例

                         

                         

     

  
  评审通过与否：通过

  


## Attachments:

[image2024-6-19_10-36-17.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTRhMWFkOWEzMzExZGM5NmM5IiwicmVmX2lkIjoiNjczOTZlNTQ1OTNmOTljOWZmMjM4M2M0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMzExLCJleHAiOjE3ODI0NTc3MTF9.Bx9_VKAfgKTGep0fqktMjAMSzegtQdfzIJrG2w9ZpKI)

 (image/png)    


[image2024-6-19_10-37-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlNTQ4OTcwYzJhZjRmNTIxODU3IiwicmVmX2lkIjoiNjczOTZlNTQ1OTNmOTljOWZmMjM4M2M0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcxMzExLCJleHAiOjE3ODI0NTc3MTF9.vE1l59diLXDvBcgMJmLuTmDVbR0m7gVOf6gPuvodghE)

 (image/png)    
