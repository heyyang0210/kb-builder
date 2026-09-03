Created by 李嘉瑞, last modified by  林博 on 一月 22, 2024

IR链接：    [YDBRD-11549](https://jira.yasdb.com/browse/YDBRD-11549?src=confmacro)    -  解决hash join/hash group/distinct算子在列存内存池不够时，分配内存报错的问题  完成

SR链接：    [YDBRD-13175](https://jira.yasdb.com/browse/YDBRD-13175?src=confmacro)    -  [列存计算] Hash join分配的物化内存不足时不能报错  完成

##   [1. Overview（概述）](#1-overview概述)  

- 该设计方案是为了当内存不足时执行hash join也可以执行，不报错内存不足


##   [2. Features（功能特性）](#2-features功能特性)  

- 减少hash join使用的内存（当内存不足时）
- 把所有hash join使用的内存都管理起来，包括未分配但是可能会分配的内存
- 支持hash table缩bucket


##   [3. Interfaces（接口）](#3-interfaces接口)  

- 新增隐藏参数：_COLUMNAR_MAX_BATCH_COUNT，决定分批的时候实际批次的最大值,如果内存不足时调整为最小值即可，不影响内存足够时的性能，范围2~65536，默认值1024


##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

该SR可以减少hash join使用的内存，但不能保证在任何条件下都能执行成功，无法减少其他算子以及存储使用的内存，只适用于部分包含hash join且内存不足的场景。

- 如果语句中包含其他算子，例如hash group等，hash group执行内存不足报错，不属于该SR需要解决的范畴
- 在实际测试中（测试数据一行大小为8K，COLUMNAR_BULK_SIZE=1024,一批数据为8M），成功执行hash join需要的最小内存为8M


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 场景描述](#51-场景描述)  

- 场景一：当join key重复的数据条数较多时，无法通过分批减少数据量。
- 场景二：当分的批数太多时，记录批次信息的元数据使用了太多内存
- 场景三：有部分内存未纳入管理（column builder），导致hash join实际使用的内存比计算出来的大
- 场景四：batch data set中，当前没有数据的批次不会分配内存，但是后面有可能会需要分配内存
- 场景五：分批后，hash table的bucket依然较大，使用内存没有下降


###   [5.2 场景一](#52-场景一)  

- 此场景无法通过分批减小内存使用，可以将所有的数据写入到磁盘中，在需要时再从文件中对应读取，


```
struct ColumnSetInFile&lt;File&gt;
where
    File: Read + Write + Seek + Send + 'static
{
    data: ColumnSetStore,
    index: File,
    len: usize,
    cache: Option&lt;(usize, ColumnSet)&gt;,
}

enum DataSets {
    InMemory((Vec&lt;Option&lt;ColumnSet&gt;&gt;, usize)),
    InFile(Box&lt;ColumnSetInFile&gt;),
}

struct ValueSets {
    data: DataSets,
    schema: Arc&lt;Schema&gt;,
    ctx: Arc&lt;dyn Context&gt;,
}
使用如上结构体代替原来的Vec&lt;Option&lt;ColumnSet&gt;&gt;

```

- 初始时，使用InMemory，由InMemory转为InFile的触发条件：使用总内存大于内存阈值并且hash table中重复度高（总元素个数除以group数）
- 向ColumnSetInFile中push ColumnSet时，需要先获取当前ColumnSetStore中文件尾的位置，并将该偏移写入index中，然后再将ColumnSet写入ColumnSetStore中
- 从ColumnSetInFile中随机读取数据时，需要先从index中读取到对应的偏移，然后将ColumnSetStore seek到指定位置，读取一个ColumnSet


###   [5.3 场景二](#53-场景二)  

- 该场景需要避免使用太多批次元数据，当分批较多并且需要再次分批时，不再增加批次元数据，新增的批次全部写入原有的最后一批中
- 触发条件：总使用内存超过一定阈值并且批次元数据使用内存占比超过一定数值


###   [5.4 场景三](#54-场景三)  

- 当前column builder会在初始化时创建，并且到执行结束释放资源之前都一直存在，可以在初始时将column builder使用的内存计算好，纳入hash join使用的内存管理中
- 由于每次执行的schema不同（列的数据类型不同），column builder使用的内存不固定，当数据类型使用内存很大（char(8000)）或一批数据行数很多时，通过schema推算一行数据占用的内存大小，然后再调整一批数据的行数，使column builder使用的内存控制在一个范围之内


###   [5.5 场景四](#55-场景四)  

- 在扩批时，新增的批次不会直接分配元素据需要使用的内存，但是这部分内存可能随时分配，需要在一开始将其纳入考虑范围，扩批时计算所有批次元数据使用的总内存，保证有足够的内存可以使用


###   [5.6 场景五](#56-场景五)  

- 在扩批后，将hash table中的group数与bucket数进行比较，如果group数与bucket数的比值小于阈值（1/10），则触发hash table缩bucket
- 缩bucket时，遍历所有的key，按照insert的方式重新生成last slot和prev slot


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

- 将columnar_vm_buffer_size调到最小，在两张表中插入大量数据做hash join
- 将columnar_vm_buffer_size调到最小，在两张表中插入大量数据开并行做hash join


##   [7.资料设计章节](#7资料设计章节)  

- 不涉及


##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Comments:

|  [](null)  ,1. ~~hash table config 里面的bucket不能变小，分批以后config 里面的bucket不能再变~~
1. ~~枚举可以使用结构体，两个都存，考虑使用泛型参数，在hash join cursor中，切换~~
1. key sets考虑不记录重复值，使用其他标识
1. ~~带join filter的场景也需要测~~
1. ~~限定最大批次（隐藏参数）~~
1. ~~控制builder占用的内存（主要是变长），到达一定阈值时直接结束~~
1. 写文件的时候有一个write buffer，64k
1. 一批数据量为x MB时，最少需要多少内存可以执行（10M）
,Posted by lijiarui at 六月 07, 2023 10:49|
|---|
