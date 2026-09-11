Created by 徐晓锋, last modified on 三月 23, 2023

## **概述：**

代价模型是数据库优化器用来衡量不同执行计划的相对性能的方法。基于一些统计信息来估算执行计划的总成本。这些统计信息通常包括表的大小、索引的大小、选择性等，具体算子与硬件配置，数据库配置参数等等。代价模型计算出每个可能的执行计划的总成本，并选择代价最小的执行计划作为最终执行计划。

代价模型的具体实现可以因数据库而异，但通常会考虑以下几个方面：

CPU成本：这通常是查询执行所需的最显著的成本。优化器需要考虑如何尽可能减少CPU的使用，例如选择最优的算法和运算顺序。

I/O成本：访问磁盘上的数据通常是查询执行的主要成本之一。优化器会尝试减少I/O次数，例如通过使用索引来减少扫描整个表的需要。

网络成本：在多DN环境下，数据分发的大小对于性能也有较大影响，优化器需要综合考虑算子与数据分发的效率，选择效率更高的一个计划。

YashanDB第一个版本实现的代价模型，只考虑了通用算子计算因子，行列也是用统一一套代价模型来衡量的，随着可选计划越来越丰富以及poc中极致性能与最优计划的要求，需要更加精确的代价模型来保证优化器在信息准确的情况下尽可能的选择到最佳计划，现规划基于Yashan自己算子的精确代价模型，行列采用不同的代价模型从而更好的衡量行引擎或列引擎选择不同的计划。

代价模型的计算，本质上是每个算子生成会有一些输入信息，根据输入信息，得到这个算子执行的一个相对性能数据，就是算子的cost model，算子的cost model需要具有横向和纵向可比性，比如，hash join的cost和merge join的cost具有可比性，hash join的cost和sort也需要具有可比性，从而优化器可以在全局层面上选择cost最低的执行计划。

## **设计思路：**

### 1，基于传统的方法测试计算。

**A，确定每个算子的代价计算公式，例如：**

**CBO初始的计算：**

cost = initScanFactor + tableStats->  rows *     tableStats->  avgRowSize   *   tableScanCostUnit  ;

**调研oracle scan 磁盘扫描cost计算：**

硬件相关的因子：

1) CPUSPEEDNW 每秒的百万操作数（default is 100）

2)  IOSEEKTIM 扫描磁盘的时间，毫秒。（default is 10）

3)  IOTFRSPEED 每毫秒磁盘传输的字节数。（default is 4096）

Multiblock Read Count：多块读的块数（default is 8）。

NOWORKLOAD下：

单块读时间计算：

sreadtime = IOSEEKTIM + db_block_size/iotfrspeed

多块读时间计算：

mreadtim = IOSEEKTIM + MBRC*db_block_size/iotfrspeed

确定单块读还是多块读，table scan大多多块读：

Cost = (#SRds + #MRds * mreadtim / sreadtime + #CPUCycles/(cpuspeed * sreadtim))

  


相关隐藏调节参数：

_table_scan_cost_plus_one：则Oracle在全表扫描或者索引ffs时会默认+1

  


**B，根据得到的模型，通过模型不同的输入值，来计算合适的模型参数。**

然后根据在不同的配置，不同的数据与不同的硬件环境下，进行执行性能测试，最终得到模型中参数的一个合理值。从而得到cost model的计算模型。

性能衡量指标可以有两个，一个是模型测试出执行时间，二是模型测试出cpu   instruction count  ，因为执行时间受外界影响较大，计划使用cpu   instruction count  来做为最后测试和确定参数的方法。这就需要一个归一描述，将IO cost，network Cost统一换算为cpu   instruction count来表示，这可以根据不同的硬件配置参数来对应，根据cpu能力，磁盘的io能力，网络配置来实现归一。最终根据硬件配置信息，数据库配置参数，算子和统计信息估算出cpu instruction count。

### 2，基于学习的方法训练（技术调研项目）

对于优化器来说，最终的输出除执行计划外，每个算子返回的行数对于执行也有一定的参考意义，所以即使使用学习的方法，期望同时返回统计信息与cost两个度量。

  


目前行列相关的算子，一共90多个不同的算子需要确定cost计算公式与相关参数，主要的算子有scan（12个*2），join（24个*2），group（3个*2），sort（1个*2），distinct（3个*2），px。

Scan估计14人周（包括三种表，lsc，tac，heap），其余18人周。

|1|行支持|列支持|物理算子|  
|
|---|---|---|---|---|
|1|Y|Y|TABLE_FULL_SCAN|  
|
|2|Y|Y|INDEX_UNIQUE_SCAN|  
|
|3|Y|Y|INDEX_RANGE_SCAN|  
|
|4|Y|Y|INDEX_FULL_SCAN|  
|
|5|Y|Y|INDEX_FULL_SCAN_MIN_MAX|  
|
|6|Y|Y|INDEX_RANGE_SCAN_MIN_MAX|  
|
|7|Y|Y|INDEX_FAST_FULL_SCAN|  
|
|8|Y|Y|INDEX_SKIP_SCAN|  
|
|9|Y|Y|PART_ALL_SCAN|  
|
|10|Y|Y|PART_SINGLE_SCAN |  
|
|11|Y|Y|PART_ITERATOR_SCAN|  
|
|12|Y|N|ROWID_SCAN|  
|
|13|Y|Y|NESTLOOP_JOIN INNER|  
|
|14|Y|N|NESTLOOP_JOIN OUTER_FULL|  
|
|15|N|N|NESTLOOP_JOIN OUTER_RIGHT|  
|
|16|Y|Y|NESTLOOP_JOIN OUTER_LEFT|  
|
|17|Y|Y|NESTLOOP_JOIN ANTI|  
|
|18|N|N|NESTLOOP_JOIN ANTI_RIGHT|  
|
|19|Y|Y|NESTLOOP_JOIN SEMI|  
|
|20|N|N|NESTLOOP_JOIN SEMI_RIGHT|  
|
|21|Y|Y|HASH_JOIN INNER|  
|
|22|Y|Y|HASH JOIN OUTER_FULL|  
|
|23|N|Y|HASH JOIN OUTER_RIGHT|  
|
|24|Y|Y|HASH JOIN OUTER_LEFT|  
|
|25|Y|Y|HASH JOIN ANTI|  
|
|26|N|Y|HASH JOIN ANTI_RIGHT|  
|
|27|Y|Y|HASH JOIN SEMI|  
|
|28|N|Y|HASH JOIN SEMI_RIGHT|  
|
|29|Y|Y|MERGE_JOIN INNER|  
|
|30|Y|Y|MERGE JOIN OUTER_FULL|  
|
|31|N|Y|MERGE JOIN OUTER_RIGHT|  
|
|32|Y|Y|MERGE JOIN OUTER_LEFT|  
|
|33|Y|Y|MERGE JOIN ANTI|  
|
|34|N|N|MERGE JOIN ANTI_RIGHT|  
|
|35|Y|Y|MERGE JOIN SEMI|  
|
|36|N|N|MERGE JOIN SEMI_RIGHT|  
|
|37|Y|?|FIRST_ROW|  
|
|38|Y|Y|SORT (ORDER BY)|  
|
|39|Y|Y|HASH GROUP|  
|
|40|Y|N|SDT GROUP |  
|
|41|Y|N|SORT GROUP|  
|
|42|Y|Y|VIEW_SCAN|  
|
|43|Y|Y|UNION 没有这个物理算子|  
|
|44|Y|Y|UNION_ALL|  
|
|45|Y|Y|HASH DISTINCT|  
|
|46|N|N|SORT DISTINCT(索引)|  
|
|47|Y|N|SDT DISTINCT（自排序）（cost太大无法构造）|  
|
|48|Y|Y|AGGR|  
|
|49|Y|Y|SORTAGGRDIST|  
|
|50|Y|Y|WINFUNC|  
|
|51|Y|Y|WINDOW|  
|
|52|N|Y|PARALLEL|  
|
|53|Y|Y|RESULT|  
|
|54|Y|Y|TOP-N|  
|
|55|Y|Y|PX（hash，random, local, remote）|  
|


  


  


  


  


  
