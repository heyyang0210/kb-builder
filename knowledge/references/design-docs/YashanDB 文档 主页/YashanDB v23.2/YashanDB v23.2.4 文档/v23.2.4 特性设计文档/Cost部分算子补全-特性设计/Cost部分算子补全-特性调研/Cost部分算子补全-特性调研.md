Created by 周湘淞, last modified on 五月 14, 2024

*# 特性调研-YDBRD-26116 : Cost部分算子补全特性调研*

*IR链接：*    [https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b294](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b294)    *?*    
  *#YASHAN-836 Cost部分算子补全*

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/6618ac33fd997db58ad7eb90](https://pingcode.yasdb.com/pjm/items/6618ac33fd997db58ad7eb90)    *?*    
  *#YDBRD-26116 Cost部分算子补全*

##   [1. 总述](#1-总述)  

由于代价计算需要正确反映算子具体实现性能，本特性调研应主要调研yasdb待补全算子的具体实现，由两部分组成：

1. 算子不同算法执行实现；
1. 算子不同算法在不同数量级下的性能摸底.


###   [1.1 需求合理性分析](#11-需求合理性分析)  

本需求要求在补全算子cost计算后，算子能够根据统计信息选到在当前数据分布下最优的算法实现，其中‘算子’主要指具有不同算法实现的算子。具体地，在本SR中指winfunc和grouping sets。

参考友商实现的具体问题在，不同数据库对同一算子的具体实现不同，特定数据库的代价实现是由该数据库算子具体实现决定的，不适用于其它数据库。比如，Postgresql窗口函数实现只支持一种算法（Postgresql见    [costsize.c](https://github.com/postgres/postgres/blob/master/src/backend/optimizer/path/costsize.c)    文件中    `cost_windowagg`    函数，对窗口函数的代价计算不包含I/O计算，这对于yasdb的窗口函数实现来说是不适用的。

因此，本需求的调研应主要由对yasdb算子实现的调研组成，友商实现的参考意义不大。基于此，以下调研主要是对yasdb实现的分析，不再对友商实现进行列举。

另外，实现算子代价计算的过程应尽可能与现有cost模型兼容，使得在不对原有算子性能造成影响的情况下，支持新算子代价和原有算子代价的比较，因此应尽可能调用原有接口。

###   [1.2 需求实现分析](#12-需求实现分析)  

####   [1. winfunc](#1-winfunc)  

#####   [执行规格](#执行规格)  

|存储类型\算子|window no sort|window sdt|window hash|
|---|---|---|---|
|行存|√|√|×|
|列存|√|×|√|


#####   [算子执行性能摸底(rows和distinct数相同)](#算子执行性能摸底rows和distinct数相同)  

######   [winfunc有order by](#winfunc有order-by)  

```
explain select count(*) from (select first_value(c1) over (partition by c1 order by c1 desc) aaa from t1);

```

|类型\rows|10|1e2|1e3|1e4|1e5|1e6|1e7|
|---|---|---|---|---|---|---|---|
|sort+no sort win(tac)|0:0.018|0:0.031|0:0.077|0:0.538|0:5.788|1:01.287|12:36.217|
|hash win(tac)|0:0.014|0:0.022|0:0.228|0:2.156|0:22.156|3:21.682|2:46:34.000未执行出结果|
|no sort win(heap)|0|0:0.0005|0:00.002|0:00.018|0:00.155|0:01.784|2:02.777|
|sdt win(heap)|0|0:0.0005|0:0.003|0:0.025|0:0.196|0:01.765|0:25.709|


大数据量下（百万级别及以上），window function算子选择如下：

|表类型|窗口函数有order by|窗口函数无order by|
|---|---|---|
|行存|SDT|SDT|
|列存|SORT+NOSORT|HASH|


#####   [执行实现参考文档](#执行实现参考文档)  

1.   [窗口函数行存执行概要设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133562545)  
1.   [列存支持窗口函数hash分区](https://conf.yasdb.com/pages/viewpage.action?pageId=133577533)  
1.   [物化区概要设计](https://conf.yasdb.com/pages/viewpage.action?pageId=147763760)  


####   [2. grouping sets](#2-grouping-sets)  

#####   [执行规格](#执行规格-1)  

|存储类型\算子|sort grouping sets|hash grouping sets|
|---|---|---|
|行存|×|×|
|列存|√|√|


#####   [算子执行性能摸底(rows和distinct数相同)](#算子执行性能摸底rows和distinct数相同-1)  

```
explain select count(*) from (select sum(c6) from tac_ten_million_t1  group by grouping sets ((c7), (c7)));

```

|类型\rows|1e5|1e6|1e7|
|---|---|---|---|
|sort gsets(tac)|00:00.629|00:06.038|01:06.550|
|hash gsets(tac)|00:00.141|00:01.197|00:38.872|


大数据量下（百万级别及以上），window function算子选择如下：

|表类型|grouping sets|
|---|---|
|列存|HASH|


####   [3. connect by](#3-connect-by)  

connect by的条数无法通过统计信息估准，Oracle中该算子的条数同样无法估准，因此依赖于条数计算的代价也无法算准。

但由于connect by算子选择具体算法不是通过代价选择的（只要connect filter中包含=就会使用hash，否则使用nest loop），不准确的cost不会影响性能。

connect by的代价可参考join的代价计算。

####   [4. 集合操作](#4-集合操作)  

集合操作中，intersect和minus的条数较难通过统计信息估准，Oracle中这两个集合算子的条数也无法估准，因此无论采用何种算法计算代价，依赖于条数计算的代价也同样是不准确的。

不过，由于集合操作只有hash一种算法，无需通过代价选择特定算法，cost不准确不影响性能。

集合操作的代价计算，可直接根据条数评估fetch代价。

###   [1.3 数据字典](#13-数据字典)  

无

###   [1.4 开源依赖](#14-开源依赖)  

无

##   [2. 接口](#2-接口)  

该特性无对外接口，用户仅能通过计划选择算子和算子cost感知。

##   [3. 规格与约束](#3-规格与约束)  

##   [4. Dependency（功能依赖）](#4-dependency功能依赖)  

无