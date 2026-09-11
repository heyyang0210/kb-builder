## 需求

当前单行执行聚合函数带distinct仅实现sort group去重并计算聚合；需要补充单行执行、批量执行中聚合函数带distinct使用hash group去重的算法

## 算法

分几种情况：

情况1.单行执行不带group by，仅聚合函数中带distinct

情况2.单行执行带group by，聚合函数中带distinct

情况3.批量执行

### 情况1

使用HDT作为去重结构，每个distinct一个，distinct key为聚合函数的参数，HDT的类型为MAT_ROW_HASH

流程：

扫描child，对于每一行执行：顺序更新不带distinct的聚合函数的结果，顺序更新每个distinct的HDT。直到child扫描完。

遍历带distinct的聚合函数表达式，对于每个表达式，扫描对应的HDT，更新聚合函数的结果。

伪代码：

```
for row in child:
    for aggr in noneDistinctAggrs:
        aggr.update(row)
    for hdt in distinctHdts:
        hdt.insert(row)
for aggr in distinctAggrs:
    hdt = getHdtByDistinctAggrArg(aggr)
    for row in hdt:
        aggr.update(row)
```

### 情况2

当是单行执行时，group的aggregate中含有distinct时，仅使用 hash group 作为分组的算法。

hash group的hdt的key为group by key，value为该分组的聚合函数结果。

每个带有distinct的聚合函数都会创建一个hdt，key为该行记录对应的主hdt的MatRowId(可以唯一表示该行) + distinct key，类型为MAT_ROW_HASH

流程：

扫描child，对于每一行执行：

1. 更新主hdt中不带distinct的聚合函数结果（一次写入）
1. 获取主hdt中该行对应分组的key row的matRowId，对于每个distinct key，插入对应hdt做去重。


扫描结束后，对于每个distinct的hdt，扫描每一行，获取matRowId，根据matRowId查找groupHdt的value，更新value中的aggr结果。

伪代码：

```
for row in child:
    groupKey = makeGroupKey(row)
    for aggr in noneDistinctAggrs:
        aggrRow.updateValue(aggr)
    matRowId = groupHdt.insert(groupKey, aggrRow)
    for hdt in distinctHdts:
        hdt.insert(MatRowId, row)
for aggr in distinctAggrs:
    hdt = getHdtByDistinctAggrArg(aggr)
    for row in hdt:
        matRowId = row.getValue(0)
        keyRow = groupHdt.getRowByMatRowId(matRowId)
        valueRow = groupHdt.find(keyRow)
        valueRow.updateAggr(aggr)
```

## 与原有sort aggr distinct算法优劣比较

sort aggr distinct算法仅一个物化区，排序算法使用merge sort。物化区保存group key、aggr(distinct)的参数，普通aggr的参数。sort key是group key + aggr(distinct)的参数。

使用hash aggr distinct，除group by使用的hdt物化区外，额外增加aggr(distinct)数量的hdt物化区。每个物化区存group by的hdt对应分组的matRowId + distinct column。

sort aggr distinct算法扫描时仅需要顺序扫描一遍merge sort后的结果。

hash aggr distinct算法需要扫描每个aggr(distinct)的hdt物化区，更新group by的hdt中对应组的value。最终顺序扫描group by的hdt返回各分组的结果。

## 计划修改

### 路径修改

原有的aggrSortDist路径和groupSortDist路径直接将原有路径做替换；修改为增加候选组，保留原有aggr路径。

### 单行执行rwrt_mat增加

在trsfMatAggr和trsfMatGroupBy中创建每个distinct column的hdt物化区的matId，并将对应aggr的参数转换为到对应物化区取值。

## demo 验证结果

  [aggr+distinct无groupby结果比较 .csv](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjc1NmE1ZDhhMWFkOWEzMzExZGU0NGFkIiwicmVmX2lkIjoiNjc1NjlkODVkMmJhZmYwZmQ1NWFkNjgyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU2OTg1LCJleHAiOjE3ODI1NDMzODV9.DkmR52ttMsCZwNDL7U2rss88HgXKpdmpoZngVoL9Odk)  

aggr + distinct带group by单行执行结果比较

c1 int, c2 number, c3 varchar(100), c4 char(100), c5 char(1000)

|数据|sql|hash distinct结果|sort distinct结果|
|---|---|---|---|
|100w条记录，顺序值|select c1, sum(distinct c2), count(distinct c3) from test_aggr_dist1 group by c1 limit 1;|00:00:05.646|00:00:08.435|
||select c1, sum(distinct c2), count(distinct c3), count(distinct c4) from test_aggr_dist1 group by c1 limit 1;|00:00:28.486|00:00:22.515|
||select c1, sum(distinct c2), count(distinct c3), count(distinct c4), count(distinct c5) from test_aggr_dist1 group by c1 limit 1;|00:01:41.491|00:03:00.570|
||select c3, sum(distinct c2), count(distinct c4), count(distinct c5), sum(distinct c1) from test_aggr_dist1 group by c3 limit 1;|00:01:28.675|00:03:11.822|
|800w条记录，顺序值,每条记录有8条重复记录|select c1, sum(distinct c2), count(distinct c3) from test_aggr_dist1 group by c1 limit 1;|00:02:22.710|00:01:07.388|
||select c1, sum(distinct c2), count(distinct c3), count(distinct c4) from test_aggr_dist1 group by c1 limit 1;|00:06:41.312|00:04:41.476|
||select c1, sum(distinct c2), count(distinct c3), count(distinct c4), count(distinct c5) from test_aggr_dist1 group by c1 limit 1;|00:13:12.390|NA|
||select c3, sum(distinct c2), count(distinct c4), count(distinct c5), sum(distinct c1) from test_aggr_dist1 group by c3 limit 1;|00:11:27.867|NA|


aggr + distinct带group by单行执行，多列

create table test_number_type (c1 number, c2 number, c3 number, c4 number, c5 number, c6 number, c7 number, c8 number, c9 number, c10 number) organization heap;

|数据|sql|hash distinct结果|sort distinct结果|
|---|---|---|---|
|100w条记录，顺序值，VM_BUFFER_SIZE=8G，无换入换出|select c1, sum(distinct c2) from test_number_type group by c1 limit 1;|00:00:00.851|00:00:00.895|
||select c1, sum(distinct c2), sum(distinct c3) from test_number_type group by c1 limit 1;|00:00:01.454|00:00:01.637|
||select c1, sum(distinct c2), sum(distinct c3), sum(distinct c4) from test_number_type group by c1 limit 1;|00:00:02.044|00:00:02.555|
||select c1, sum(distinct c2), sum(distinct c3), sum(distinct c4), sum(distinct c5) from test_number_type group by c1 limit 1;|00:00:02.655|00:00:03.385|
||select c1, sum(distinct c2), sum(distinct c3), sum(distinct c4), sum(distinct c5), sum(distinct c6) from test_number_type group by c1 limit 1;|00:00:03.281|00:00:04.494|
||select c1, sum(distinct c2), sum(distinct c3), sum(distinct c4), sum(distinct c5), sum(distinct c6), sum(distinct c7) from test_number_type group by c1 limit 1;|00:00:04.222|00:00:05.497|
||select c1, sum(distinct c2), sum(distinct c3), sum(distinct c4), sum(distinct c5), sum(distinct c6), sum(distinct c7), sum(distinct c8) from test_number_type group by c1 limit 1;|00:00:04.393|00:00:06.556|
||select c1, sum(distinct c2), sum(distinct c3), sum(distinct c4), sum(distinct c5), sum(distinct c6), sum(distinct c7), sum(distinct c8), sum(distinct c9) from test_number_type group by c1 limit 1;|00:00:05.033|00:00:07.840|
||select c1, sum(distinct c2), sum(distinct c3), sum(distinct c4), sum(distinct c5), sum(distinct c6), sum(distinct c7), sum(distinct c8), sum(distinct c9), sum(distinct c10) from test_number_type group by c1 limit 1;|00:00:05.635|00:00:08.924|
|800w条记录，顺序值,每条记录有8条重复记录,VM_BUFFER_SIZE=8G|select c1, sum(distinct c2) from test_number_type group by c1 limit 1;|00:00:06.301|00:00:07.991|
||select c1, sum(distinct c2), sum(distinct c3) from test_number_type group by c1 limit 1;|00:00:09.860|00:00:15.930|
||select c1, sum(distinct c2), sum(distinct c3), sum(distinct c4) from test_number_type group by c1 limit 1;|00:00:13.409|00:00:24.789 |
||select c1, sum(distinct c2), sum(distinct c3), sum(distinct c4), sum(distinct c5) from test_number_type group by c1 limit 1;|00:00:17.358|00:00:34.277 |
||select c1, sum(distinct c2), sum(distinct c3), sum(distinct c4), sum(distinct c5), sum(distinct c6) from test_number_type group by c1 limit 1;|00:00:20.992|00:01:19.300|
|800w条记录，顺序值,每条记录有8条重复记录,VM_BUFFER_SIZE=128M|select c1, sum(distinct c2) from test_number_type group by c1 limit 1;|00:00:06.030|首次 00:00:29.244,非首次 00:00:09.817|
||select c1, sum(distinct c2), sum(distinct c3) from test_number_type group by c1 limit 1;|00:00:22.054|首次 00:00:48.058,非首次 00:00:20.522|
||select c1, sum(distinct c2), sum(distinct c3), sum(distinct c4) from test_number_type group by c1 limit 1;|00:01:18.257|首次 00:01:22.777,非首次 00:00:35.006|
||select c1, sum(distinct c2), sum(distinct c3), sum(distinct c4), sum(distinct c5) from test_number_type group by c1 limit 1;|00:02:15.580|首次 00:01:48.457,非首次 00:01:09.275|
||select c1, sum(distinct c2), sum(distinct c3), sum(distinct c4), sum(distinct c5), sum(distinct c6) from test_number_type group by c1 limit 1;|00:05:26.964|首次 00:02:55.569,非首次 00:01:54.003|
||select c1, sum(distinct c2), sum(distinct c3), sum(distinct c4), sum(distinct c5), sum(distinct c6), sum(distinct c7) from test_number_type group by c1 limit 1;|00:08:34.783|首次 00:03:58.443,非首次 00:02:50.892|


