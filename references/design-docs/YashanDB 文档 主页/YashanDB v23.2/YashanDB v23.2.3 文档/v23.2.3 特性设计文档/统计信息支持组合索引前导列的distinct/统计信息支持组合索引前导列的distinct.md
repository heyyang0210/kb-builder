Created by 郑翌恺, last modified on 五月 20, 2024

*SR链接：YDBRD-21458*

  [[YDBRD-21458] 统计信息支持组合索引前导列的distinct - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-21458)  

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-%E6%80%BB%E8%BF%B0)  

收集组合索引前导列的distinct是为了cbo的  INDEX SKIP SCAN（索引跳跃扫描）

INDEX SKIP SCAN是一种查询优化技术，  跳过组合索引的第一列，直接访问索引的第二列或更后面的列。这样即使在一次查询中没有使用组合索引的前导字段，该索引也可以通过INDEX SKIP SCAN被有效利用

这样可以提高查询效率，避免全表扫描，特别是当索引的第一列的distinct很低，而第二列或更后面的列distinct很高时。  INDEX SKIP SCAN的效率会随着前导列distinct值的递增而减少

只适用于B-tree索引（包括唯一索引和非唯一索引）

该需求将收集最多4列的组合索引前导列distinct统计信息

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-%E6%8E%A5%E5%8F%A3)  

### 2.1 ind$，indpart$修改

系统表ind$新增3个字段存储4列前导列的distinct

核心系统表ind$修改硬编码

如果不增加字段，优化器无法获取前导列distinct

```
CREATE TABLE IND$
(
    DISTINCT_KEYS   BINARY_BIGINT, //整体distinct
    DISTINCT_FKEYS  BINARY_BIGINT, //之前预留字段
    DISTINCT_2KEYS  //新增列
    DISTINCT_3KEYS  //新增列
    DISTINCT_4KEYS  //新增列
) SYSTEM 2 ORGANIZATION HEAP
/
```

  


### 2.2 dba_ind_statistics

dba_ind_statistics新增3个字段存储4列前导列的distinct

### 2.3 dbms_stats高级包参数修改

set_index_stats新增3个参数，用户可以手动设置前导列distinct，不能大于组合索引列数

##   [  
3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

该字段只对  B-tree组合索引生效  ，其他类型索引也会遵循下列规则检测并写入，不会报错

反向索引为B-tree索引，在收集时拿到的数据与正常索引无差别，可以收集前导列distinct

组合索引columnCnt<4，超过columnCnt的前导列distinct重设为0

前导列distinct不会大于整体distinct

set_index_stats约束

- 用户可以设置distinct，dist(n)keys为null，省略字段也视为null进行处理
- 新增3个字段dist2keys, dist3keys, dist4keys，这三个字段可以省略，省略时默认为0


当没有字段为null时

- 用户设置distinct时，需遵循dist1keys <= dist2keys（未被省略）<= dist3keys（未被省略）<= dist4keys（未被省略）<= distinct，否则会报错
- 用户设置distinct时，如果索引列数 = n <= 4，则dis(n)keys = distinct，否则会报错
- 用户设置前导列distinct时，会检测索引的列数，如果索引列数 = n <= 4，且用户设置dist(n)keys, dist(n+1)keys，dist(n+2)keys不符合上述规则，不会报错，会将dist(n+1)keys，dist(n+2)keys重设为0


当有字段为null时

- 整体distinct为null，不会检测任何前导列distinct，distinct和前导列distinct重设为0写入
- 整体distinct不为null，会检测null所在位置，对于null之前的distkeys字段，会进行检测，对null之后的distkeys字段，null重设为0，非null正常写入


```
index column = 2
exec DBMS_STATS.SET_INDEX_STATS('SALES', 'IDX_FINANCE_INFO_1', null, 100, 10, 10, 1, 10, 10, 1, 1, 10, 10000, 100);   //索引只有两列，不会检测dist3keys和dist4keys合法性，重设为0

index column = 3
exec DBMS_STATS.SET_INDEX_STATS('SALES', 'IDX_FINANCE_INFO_1', null, 100, 10, 10, 1, 10, 10, 1, 1, 2);    //省略了dist3keys和dist4keys，dist1keys < dist2keys < distinct，不会报错
exec DBMS_STATS.SET_INDEX_STATS('SALES', 'IDX_FINANCE_INFO_1', null, 100, 10, 10, 1, 10, 10, 1, 1, 100);  //省略了dist3keys和dist4keys，但是用户输入的dist2keys大于整体distinct，会报错
exec DBMS_STATS.SET_INDEX_STATS('SALES', 'IDX_FINANCE_INFO_1', null, 100, 10, null, 1, 10, 10, 1, 1, 100); //distinct = null，不报错，重设distinct = 0和dist(n)keys = 0
exec DBMS_STATS.SET_INDEX_STATS('SALES', 'IDX_FINANCE_INFO_1', null, 100, 10, 10, 1, 10, 10, 1, 1, 2, null, 4);  //null所在位置为dist3keys字段，检测dist1keys和dist2keys合法性，dist3keys=0，由于索引列数=3，重设dist4keys = 0
exec DBMS_STATS.SET_INDEX_STATS('SALES', 'IDX_FINANCE_INFO_1', null, 100, 10, 10, 1, 10, 10, 1, 1, 2, 3, null);  //null所在位置为dist4keys字段，检测dist1keys和dist2keys和dist3keys合法性，dist4keys不检测，重设为0

index column = 5
exec DBMS_STATS.SET_INDEX_STATS('SALES', 'IDX_FINANCE_INFO_1', null, 100, 10, 10, 1, 10, 10, 1, 1, 2, null, 4);  //null所在位置为dist3keys字段，检测dist1keys和dist2keys合法性，dist3keys=0，由于索引列数=5，dist4keys = 4
```

  


##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-%E7%89%B9%E6%80%A7)  

###   [4.1 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)    数据结构

```
typedef struct StStatsManager {
    /* for composite index first distinct */
    MtrlContext* fDstCtx;   //新增4个物化区存储最多4列前导列的f(i)值，使用F1算法估算distinct需要用到
    MtrlSortKey* fDstKey;   
} StatsManager;

#define STATS_INDEX_LEADCOL_DISTINCT_COUNT 4
typedef struct StIndexStats {
    CodUint64 firstDistinct;           //删除该项，之前的firstDistinct未收集恒为0
    CodUint64 leadColDistinct[STATS_INDEX_LEADCOL_DISTINCT_COUNT]; // 新增该项，用数组存储最多4列前导列distinct
} IndexStats;
```

### 4.2 采样率 < 1情况下估算distinct(F1算法)

1.  基于采样的distinct估计的关键在于样本dictinct到总体的还原，不能简单的采用线性还原的方式。目前的做法是在样本distinct值的基础上，根据distinct值的分布，对样本distinct进行校正得到总体的distinct，需要通过物化区来完成

![](https://conf.yasdb.com/download/attachments/76906509/image2022-3-3_9-57-1.png?version=1&modificationDate=1646272383000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDg3NDYsImV4cCI6MTc4MjMxOTU0Nn0.grJdq9jvWgaGPHbhGiwTK6qS_Z11AePu05eI7DsLh5c)

其中：

- n: 样本容量
- d: 样本的distinct数量
- q: 抽样率
- f(i): 样本中正好出现i次的distinct数量


2.物化区转  换

已merge的物化区

|数据|出现次数|数据|出现次数|数据|出现次数|
|---|---|---|---|---|---|
|a|3|b|1|c|3|


该情况下出现3次的数据是a和c，一共两组，出现1次的数据是b，一共一组，即f3 = 2 ，f1 = 1

用于估算distinct的物化区dstMtrl

|数据|出现次数|数据|出现次数|
|---|---|---|---|
|1|1|3|2|


###   [4.3 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)    详细设计

获取索引整体distinct时，已经持有排序完成的物化区，通过以下流程可以得到前导列distinct，存储在stats->leadColDistinct[4]中

```
n = 样本总体distinct，d[4]为前1，2，3，4前导列distinct，v[4]存储上次检索得到的不同数据，mtrl[4]存储f1，f2，f3......
 
typedef struct StDistinctVal {
    CodBytes  value;
    CodUint64 count;
} DistVal;
 
/* 根据整体distinct计算前导列distinct，mtrl用于估算distinct（采样率<1） */
for i = 0......n do {                           //取一行数据
    从整体有序的物化区中获取distVal
    for j = 0.....min{index.desc->colCount, 4} do {          //取该行的前导列数据
        if (v[j].value != distVal[j].value) {             //如果本次前导列数据跟上次的前导列数据不一致，distinct++
            d[j]++;
            v[j] = distVal[j];
            statsInsertDistMtrl(mtrl[j], (v[j].count，1));    //插入物化区（f[v[j].count]，出现次数）：（v[j].count，1）
        }
    }
}
 
for i = 0.....min{index.desc->colCount, 4} do {                           //估算distinct
    ankMtrlSort(mtrl[i]);
    statsCalcDist(mtrl[i]);
}
```

###   [4.4 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)    优化点

indexColumnCnt < 4，leadColDistinct[indexColumnCnt - 1] = distinct，不需要重复计算一次整体distinct

##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

覆盖indexColumnCnt<4和>4的情况

增加数据量估算distinct，数据量较小的情况下，即使用户指定了采样率<1，在收集时会自动将采样率修改为1，精确计算distinct

##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

修改    [DBMS_STATS.md](http://DBMS_STATS.md)    ，增加关于组合索引前导列distinct的描述，修改set_index_stats参数

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

优化器适配，通过前导列distinct选择是否需要进行索引跳跃式扫描