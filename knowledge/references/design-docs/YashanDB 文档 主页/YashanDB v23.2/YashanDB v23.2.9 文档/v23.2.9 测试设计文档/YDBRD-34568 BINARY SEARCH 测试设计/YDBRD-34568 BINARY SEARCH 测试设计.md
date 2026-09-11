##   [1. ](https://conf.yasdb.com/pages/viewpage.action?pageId=153021088#1-%E6%80%BB%E8%BF%B0)  概述

  


本文描述 通过批量执行实现order by性能优化测试设计。

*SR链接：*  [https://pingcode.yasdb.com/pjm/items/67177d0ce489dd0868fc429d?](https://pingcode.yasdb.com/pjm/items/67177d0ce489dd0868fc429d?)  

#YDBRD-34568 IN BINARY SEARCH 规格增强

开发设计文档：  [(1657) 知识管理 - PingCode](https://pingcode.yasdb.com/wiki/spaces/LIUDENGKE/pages/67396fc6593f99c9ff23933b)  

# 2. 需求分析

     BINARY SEARCH是通过二分法来匹配结果，在某些场景下，如in list的值较大的场景下，这种方式可能会比顺序匹配性能要来的快。旧版本已经做了部分适配，但是场景不够全面，该SR对覆盖场景进行补全，提升支持范围。

背景：

1）旧版本FILTER IN LIST数量小于2048时，才会走BINARY SEARCH；新版本要放大到33W个也支持；

2）旧版本多列IN不支持； 新版本要支持；

3）旧版本算子覆盖范围有遗漏；新版本全部补齐，和谓词排序的规格保持一致；

           

## 2.1 功能点分析

1）支持  FILTER IN LIST数量大于2048时，也会走BINARY SEARCH，33w个也支持；

2）支持多列in走BINARY SEARCH

3）IN出现在任何算子上，都要能走到，除去ACCESS，目前range scan的谓词过滤是access;

4) nachr,nvarchar复杂数据类型也支持走；

5）in list里面的类型不一样时，出现null,空串的时候，也能走；



## 2.2 应用场景

- ***单机行存***
- IN LIST较多时，较为明显的性能提升；----性能测试
- 此算法时生效时谓词计划打印关键字：“IN BINARY SEARCH”；---可测性，通过IN BINARY SEARCH关键字判断
- SELECT * FROM employees   
WHERE (first_name, last_name, email) IN 
(('Guy', 'Himuro', 'GHIMURO'),('Karen', 'Colmenares', 'KCOLMENA')) ；


  


## 2.3 规格约束

IN出现在任何算子上，都要能走到，除去ACCESS，目前range scan的谓词过滤是access;

# 3. 详细测试设计

## 3.1 测试设计方法

主要采取场景构造法，等价类划分法设计测试用例 查看计划和结果是否正确

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点*


  


|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|:---|---|:---|:---|:---|:---|
|filter in list|in 数量|<2048,2048个,1000个,100个,1w个,33w个||33w+1个？,2个,1个|上限值|
|多列in|多列in个数|<2048,2048个,1000个,100个,1w个,33w个||34w,2个,1个||
|数据类型|过滤列数据类型|字符串,数字,nchar,nvarchar||||
|  
|in list里面数据类型|全是一致||||
||in list里面数据类型不一致|in(1,2,null,'',' ','1',false,'2020-1-1')|||  
|
||in 里面含有变量|c1 in(c2,c3,c1+1)|不支持||  
|
||in里面含有子查询|||||
|谓词|含有and 连接的多个in |c1 in(1,2,3,4,5,6...) and,c2 in (1,2,34,5,6) and (1,c2) in((1,2),(1,3),(2,3))| 支持|||
||含有or 连接的多个in |c1 in(1,2,3,4,5,6...) or,c2 in (1,2,34,5,6) or (1,c2) in((1,2),(1,3),(2,3))|支持|||
||and or 组合|c1 in(1,2,3,4,5,6...) or,c2 in (1,2,34,5,6) and (1,c2) in((1,2),(1,3),(2,3))|支持|||
||and or和其他非in的条件类型组合|c1 in(1,2,3,4,5,6...) or c2>1 and c1<>0,c2 in (1,2,34,5,6) |支持|||
||和like,not like <> >= 正则匹配，is nnull is not null，between and等等结合||支持|||
||和not in ，exists not exists结合||支持|||
|谓词出现的算子|表扫描：table scan,TABLE ACCESS BY INDEX ROWID,分区扫描: part scan all,part scan iterator,part  scan single,PART_INDEX_SCAN,AC扫描 ：,ACSCAN,PART_AC_SCAN,表函数：,_TABLE_FUNC_SCAN,,||||  
|
||索引扫描：where 条件后,index fast full scan,index full scan,INDEX UNIQUE SCAN,INDEX FULL SCAN DESCENDING,INDEX FULL SCAN (MIN/MAX)|||INDEX RANGE SCAN ,INDEX RANGE SCAN DESCENDING,INDEX RANGE SCAN (MIN/MAX)|  
|
||JOIN算子上：在 join on后,HASH JOIN OUTER,HASH JOIN FULL OUTER,HASH JOIN SEMI,HASH RIGHT OUTER,,MERGE JOIN,,NEST LOOPS SEMI,NEST LOOPS inner,NEST LOOPS OUTER||||  
|
||RESULT,VIEWSCAN,并行算子 PX,|||||
|场景组合||和order by,group by  ：在having  后,聚合函数,cte|||  
|
||dml|insert into select,delete,update,merge,cte,union,union all,minus/all,intersect/all|||  
|
||ddl|create table as select ,create view as select |||  
|
||not in ||不支持||  
|
||位置|在投影列子查询中,在fom 子查询中||||
||使用绑定参数的动态计划|select * from t1  where c1 in(?,?,?,?,?);|不支持||  
|
|  
|嵌套表||||  
|
|  
|外部引用|外部引用子查询中,外部引用的父查询中|||  
|
|  
|并行算子PX,|heap表的表扫描支持并行|支持||  
|
|谓词来源  
|谓词来源|自身的谓词：where  on having指定,下推的谓词 join 的谓词下推到表或索引上,通过上提的获取的谓词,|||  
|
|  
表类型|临时表,分区表,视图||||  
|
|部署形态  
||行表 单机集群||列表和分布式不支持|  
|


DFX功能测试点

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
|性能------对比master----赵育的工程--------jdbc|是，和master主干版本对比性能，查看性能提升，构造数据量在10w,100w,1000W的表,执行单列in，元素100个，1000个，3000个的性能对比，覆盖表扫描和索引扫描,|
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



# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

*机器ip：*

*操作系统：x86系统*

# 7. 工作量评估

工作量：

计划测试完成时间：

  


测试设计评审纪要  

与会人：李攀、赵育、刘登科

评审时间：2024.11.26

评审地点：1012会议室

评审纪要信息：

1、等价类优化一下 2048附近的就可以

2、filter组合测一两种就可以

3、AC是列表 计划可以看到，实际走的是列的

4.可更新视图不生效

5.外部引用常量的时候，生效

                         

     

  
评审通过与否：通过