Created by 张地强, last modified by  施新华 on 十一月 14, 2023

开发设计：    [hash table optimize](hash-table-optimize_109584193.html)  

SR：YDBRD-13174

# **1. 概述**

本文描述hash table optimize功能的测试设计

SR：    [YDBRD-13174](https://jira.yasdb.com/browse/YDBRD-13174?src=confmacro)    -  [列存计算] 根据计划给的信息，优化hash table的内存使用  完成

# **2. 需求分析**

- 在做hash join时，当右表的数据量比较大而且重复度比较低的时候，hash table会需要使用比较大的连续内存，每次扩容都是成倍增加使用内存，开销很大。
- 本设计方案计划使用二维数组代替，扩容时增加固定容量，不再需要拷贝内存。
- 根据优化器计算出的信息在一开始确定hash table的大小，尽量减少扩容次数。


# **3. 测试**  **设计方法**   

主要采用场景法，边界值法等测试方法。

# 4.   **详细测试设计**

## 2.1 tpch测试

测试依据：功能涉及执行层内部的改动，需保证不影响sql执行的结果正确性：

1、没有跑到二维数组的情况，不影响功能和性能，与老版本保持一致

2、跑到了二维数组的情况，不影响功能，性能无明显下降；

测试方案：

```
1、调整：COLUMNAR_DYNAMIC_ARRAY_THRESHOLD  的值保证覆盖上述2种场景；

2、分布式/单机分别执行多轮tpch查询（100G数据量）；单机关注功能及性能；分布式只关注功能；
```

2.2 COLUMNAR_DYNAMIC_ARRAY_THRESHOLD参数测试

测试依据：COLUMNAR_DYNAMIC_ARRAY_THRESHOLD 是使用二维动态数组的阈值，如果统计信息给的build表行数不超过这个值，仍使用原来的vec，否则使用二维动态数组。 默认值 4000000

测试方案：

```
1、默认值测试
select * from dx$parameter where name='COLUMNAR_DYNAMIC_ARRAY_THRESHOLD';
2、边界值测试
待确认
3、参数修改测试
alter system set COLUMNAR_DYNAMIC_ARRAY_THRESHOLD=4000000;
select * from dx$parameter where name='COLUMNAR_DYNAMIC_ARRAY_THRESHOLD';
4、参数功能测试
build表行数 > COLUMNAR_DYNAMIC_ARRAY_THRESHOLD :使用二维数组
build表行数 <= COLUMNAR_DYNAMIC_ARRAY_THRESHOLD :使用一维数组
测试sql:select /*leading(t1,t2)*/ count(*) from t1 join t2 on t2.c1=t1.c1;
预期：通过autotrace 观察一维数组及二维数组的使用
```

## 2.3   COLUMNAR_MAX_HASH_BUCKET参数测试

测试依据：COLUMNAR_MAX_HASH_BUCKET 最大hash bucket数，表示执行所能接受的最大hash bucket数（对应hash join右表的distinct行数），hash table的初始容量不会超过这个参数，防止因统计信息不准导致执行使用过大内存。默认值 40000000

测试方案：

```
1、默认值测试
select * from dx$parameter where name='COLUMNAR_MAX_HASH_BUCKET';
2、边界值测试
待确认
3、参数修改测试
alter system set COLUMNAR_DYNAMIC_ARRAY_THRESHOLD=4000000;
4、参数功能测试
select /*leading(t1,t2)*/ count(*) from t1 join t2 on t2.c1=t1.c1;
build表distinct行数>COLUMNAR_MAX_HASH_BUCKET，hash table 的预分配的内存取 COLUMNAR_MAX_HASH_BUCKET
build表distinct行数<=COLUMNAR_MAX_HASH_BUCKET, hash table 的预分配的内存取 build表行数的对应内存
测试sql:select /*leading(t1,t2)*/ count(*) from t1 join t2 on t2.c1=t1.c1;
预期：观察 autotrace 中内存扩容及预分配的情况
```

## 2.4 扩容场景

测试依据：该优化主要解决连续内存的问题，一维数组  扩容都是成倍增加使用内存，二维数组扩容时增加固定容量，不再需要拷贝内存

测试方案：

```
1、一维与二维扩容的区别
通过COLUMNAR_DYNAMIC_ARRAY_THRESHOLD=1024限制预分配内存
一维：COLUMNAR_DYNAMIC_ARRAY_THRESHOLD = COLUMNAR_DYNAMIC_ARRAY_THRESHOLD_4294967295
二维：COLUMNAR_DYNAMIC_ARRAY_THRESHOLD = COLUMNAR_DYNAMIC_ARRAY_THRESHOLD 1024
测试sql:select /*leading(t1,t2)*/ count(*) from t1 join t2 on t2.c1=t1.c1;
build表行数：400000
内存观测：autotrace或者select * from V$ALLOCATOR where name like 'ColumnarVmBuffer';
```

## 2.5 并行度的影响

测试依据：  并行时统计信息给的值需要除以并行度，再与COLUMNAR_DYNAMIC_ARRAY_THRESHOLD/COLUMNAR_MAX_HASH_BUCKET比较

测试方案：

修改并行度执行2.2、2.3中的参数功能测试

观测autotrace

## 2.6 内存不足测试

测试依据：  当内存不足时，需要先申请配额，无法申请足够的内存时，也不能超过内存使用限制

测试方案：

1、内存不够，预分配会变小

# 5.   **测试用例**

# 6.   **测试框架设计**

本次测试采用手动测试，confluence文档形式输出测试结果。

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|
