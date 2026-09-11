Created by 李燕琼, last modified on 十月 31, 2023

#   [SSM支持多实例空间分配](#ssm支持多实例空间分配)  

IR链接：     [https://jira.yasdb.com/browse/YDBRD-12174](https://jira.yasdb.com/browse/YDBRD-12174)  

##   [1. Overview（概述）](#1-overview概述)  

###   [YashanDB SSM](#yashandb-ssm)  

YashanDB当前的segment通过extent map来管理extent， 通过ssm来管理segment内数据页面的空闲度。segment上记录了高水位线，高水位线以下的block都是加入了ssm tree的block。

通过ssm tree查找符合空闲度的数据页面，如果没有找到，会触发ssm tree的扩展， ssm tree的扩展包括以下步骤：

- 查看segment高水位线以上是否还有页面，如果没有， 先扩展segment，申请新的extent
- ssm tree当前的meta data block是否已满，如果满了，将block初始化为ssm mata block，并加入ssm tree， 推高水位线
- 初始化一批data block， data block的数量受到当前L1上的容量，高水位以上的extent的大小，以及原子操作可以修改的最大block数的影响(128)
- 将data block加入L1 Block， 推高水位线。


![](https://pingcode.yasdb.com/atlas/files/public/67396a888970c2af4f51fe92/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUNCQUFBQUFBQUFBQUFBZ0FBQUFBQUFBRUFRQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBRUFBSUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTI0MjAsImV4cCI6MTc4MjIyMzIyMH0.1vVvdzAP68p2xPP9Hkdz4ohhNU-XnO2q-f_Qj7jDkx8)

从SSM的扩展可以看出YashanDB与Oracle的差别：

1. L1上满了才会申请下一个L1， L1可能在Extent的任何位置.
1. L1上都是Format过的Data Block，不会有Meta Block.
1. 高水位线以上的Block没有对应的SSM Meta Block.


###   [共享集群SSM的问题](#共享集群ssm的问题)  

共享集群在多实例一起导入数据时，页面冲突太大，在空闲空间元数据管理页面，数据页面上都存在冲突，这就导致两实例总是在互相请求最新页面。从TPCC两实例导入100仓数据的数据来看：192.168.3.104  192.168.3.109单实例100并发导入100仓数据：1m30s两实例100并发导入100仓数据：14m+优化思路：降低SSM元数据页面和数据页面在共享集群上的页面冲突，可以将SSM L1页面按实例划分，每个实例从L2上找到自己实例的L1。

共享集群下导入数据时，segment extending的等待时间在变得更长，共享集群下attach block的时间比单机慢，这就导致ssm扩展的时候，会花费更多的时间，ssm不能并发扩展，其他session都只能等待。优化思路：缩短ssm扩展的时间，将format data block的时间分散到各个等待的session上。

基于上面的两个优化思路，现有SSM存在两个问题：

**问题一：不能并发Format Block**

在SSM 扩展过程中，Data Block Format之后，会一起挂到L1上，这个过程不能并行，因为Data Block上要记录Parent L1，以及在L1上的位置，所以Format Blocks和Blocks挂到L1上这个过程必须是串行的，否则Data Block上记录的Parent可能就跟实际挂到L1上的位置不一样了。

当SSM 上没有可用的Data Block，需要扩展，只能有一个线程初始化Data Blocks，并挂到L1上，其他线程都只能等待，在单机并发导入数据的场景下，segment extending等待事件是瓶颈，集群在Buffer层的开销要比单机大，这个过程就变长了，其他线程等待的时间会更长。

**问题二：L1冲突大**

L1上都是Format过的Data Block， 且受到原子操作的影响，每次推水位线都只能推128个Blocks，L1的Capacity是1024，所以每次推水位线之后，最多只有2个L1是可用的，大部分时间都是只有一个L1上有可用的Data Block， 多个实例分到同一个L1上，Change Freeness的时候就会导致L1的冲突大，在集群下，L1会被在实例之间来回拉，降低并发导入性能。将L1按照多实例划分的前提是有多个可用L1，从导入数据角度来看，同一时刻，只有1个或2个可用的L1(大部分情况下只有一个可用的L1)， 且L1上只有128个可用的DataBlock，无法支撑在共享集群下降L1按照多实例划分。

##   [2. Features（功能特性）](#2-features功能特性)  

|功能|设计表现|设计说明|
|---|---|---|
|并发format block||L1上记录unformat block， 空闲空间查找的多个线程可以并发format多个range的block|
|基于L1扫描segment||高水位线以下会存在unformat block，需要跳过|
|推低水位线||进行segment scan需要更新低水位线|
|L1多实例划分||L1只属于一个实例，优先使用当前实例的L1， 没有可用的去别的实例steal|


##   [3. Interfaces（接口）](#3-interfaces接口)  

不涉及

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

由于元数据页面变多，且L1不会存满，SSM如果只有一个root，会导致segment的大小上限变得不确定，所以需要支持多个L3，但是目前只支持到一个，从用户使用方法上不感知。

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

基于上面两个问题，本次通过新的SSM架构，即ASSM（Auto Segment Sapce Management）实现以下能力：

**L1上支持并发Format Block**  L1上要支持并发Format Block，就要把未初始化的Data Block也记录到L1上，Data Block的Parent L1以及在L1上的位置就是确定的，空闲空间查找的时候，找到未初始化过的Block，按照Group，一次初始化一批Block， 再更新这批Block在L1上空闲度。

**多个可用L1**

L1不需要满了再分配下一个L1，在Extent Size较小的时候，每扩展一个Extent， 多分配几个L1。

**L1按实例划分**  L1划分到实例上，本实例优先用属于自己实例的L1， 没有可用L1，去别的实例上steal L1.

###   [5.1 ASSM Segment 扩展](#51-assm-segment-扩展)  

ASSM 将原来SSM扩展的流程拆分成了两个流程，ASSM扩展和Format Data Block

####   [5.1.1 ASSM扩展流程](#511-assm扩展流程)  

只涉及ASSM元数据页面的修改， 一次扩展一个Extent，只为新扩展的Extent分配SSM Meta Block，减少了SSM Extend的时间。当SSM Tree上找不到可用的Data Block，需要扩展一个Extent时，以1024大小的Extent为例：

1. 按照分配规则，计算extent需要的L1数量，1024大小的L1需要4个L1
1. Format 4个 L1, 这个4个L1的instance id为当前扩展ssm的实例ID，每个L1一次记录extent上的256个block，freeness为unformat状态，第一个L1记录的前4个Block为L1 Block，在L1上的freeness为0， 即FULL Block。
1. 将New的4个L1 Block记录在L2上
1. 更新segment block上的ASSM Info，以及新的高水位线和高水位线所在的L1 block


![](https://pingcode.yasdb.com/atlas/files/public/67396a88a1ad9a3311dc7d09/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUNCQUFBQUFBQUFBQUFBZ0FBQUFBQUFBRUFRQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBRUFBSUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTI0MjAsImV4cCI6MTc4MjIyMzIyMH0.1vVvdzAP68p2xPP9Hkdz4ohhNU-XnO2q-f_Qj7jDkx8)

oracle 在扩展segment的时候，会将extent的L1,  L2，L3分配好，通过undo来保证这个过程的原子性，从表空间申请extent，给L2上add L1，以及在将Extent挂到extent map上，修改segment block都记录了undo，保证了申请失败可以回滚。

YashanDB从表空间申请extent，以及把extent挂到segment上与oracle的设计不同，不是通过事务保证这个动作的完整性，而是通过原子操作来完成的。这个原则不能打破，依然通过原子操作来保证申请extent的原子性，从表空间申请extent到segment上的原子操作内就不适合修改过多的页面，因此，segment申请extent保持原来的流程。

1. 从表空间申请extent
1. 将extent挂到extent map上
1. 更新segment extent ctrl


L1, L2, L3的申请依然保留在SSM部分，需要做以下改动：

1. 新扩展的Extent分配多个L1
1. L1，L2,  L3在一个Extent的前面


每个Extent在分配L1之前，要根据extent size，以及当前segment的大小，计算需要分配多少个L1，如果只需要一个L1，则看当前可用的L1是否放得下，如果可以，就不申请L1。

根据需要申请的L1数量，查看当前可用的L2是否还有足够的空间，如果当前L2不够用，则需要再申请一个L2

如果需要申请新的L2， 还需要看一下当前L3是否已满，如果满了，还需要申请L3。

将这些需要申请的L1, L2, L3初始化好之后，再挂到SSM Tree上。

最后再推高水位线，这部分的原子性只能依靠原子操作保证，还要保证跟数据库重启回滚部分不会造成死锁。

这个方案与Oracle有两点不同：

- Oracle的Segment内的所有Extent都有L1/L2/L3 ，YashanDB在推水位线的时候才给Extent分配SSM Block。
- Oracle在一个Extent内的元数据管理页面顺序是L1, L2, L3，Extent Map Block/Segment Block，YashanDB的顺序是Extent Map Block/Segment Block， L3， L2, L1，我们只要保证一个Extent内L1 Blocks是连续的，Extent尾部是连续的Data Blocks就可以。


####   [5.1.2 Format Block流程](#512-format-block流程)  

将原来Format Data Block的动作拆分出来，在空闲空间查找的时候进行。可以多个session同时format不同的block range。通过L3 -> L2 -> L1找到对应实例的L1

1. 在L1上随机查找Data Block， 如果找到一个未初始化的Data Block，则记录下这个这个Data Block所在的group， 一个group为16个block
1. 初始化这个group所在的data block
1. 更新对应的L1上的freeness range


format group划分：如果一个extent不足16个block，这个extent就是一个format group如果extent大于16， 则每16个block一个group， 最后剩下的不足16个的block一个group。

###   [5.2 并发Format Data Block](#52-并发format-data-block)  

为了实现并发format data block， L1 Block的物理结构重新设计

####   [5.2.1 L1 Block Format](#521-l1-block-format)  

原有的L1 Block已不能满足ASSM的要求，重新设计了ASSM L1 Block的页面结构。L1 block上要记录unformat状态，且必须保留block的extent信息(为了实现基于L1的segment scan)。因为未初始化的Data Block加入了L1，需要增加一个标识页面未初始化的Freeness，为了兼容旧版本的Block在Freeness上的逻辑，原有的Freeness保持不变，新增Freeness X0FF表示UnFormat Block。

```
typedef struct StBlockRange {
    SpaceBlockId start;
    CodUint16    length;
    CodUint16    offset;
} BlockRange;

typedef struct StAssmL1Block {
    AssmBlockHead ssmHead;
    CodDate       lastActiveTime; // reserved
    CodUint16     instanceId;
    CodUint16     firstBlock;     // first data block
    CodUint16     firstFreeBlock; // first free data block
    CodUint16     nXoffset;       // number of xid offset
    CodUint8      nXid;           // number of xid
    CodUint8      nRanges;        // number of ranges
    BlockRange    ranges[ASSM_MAX_BLOCK_RANGE];
    CodUint8      frnsNode[SSM_BLOCK_MAX_CAPACITY];
    CodUint8      xidOffsets[SSM_BLOCK_MAX_CAPACITY];
    Xid           xids[SSM_L1_XID_COUNT];
} AssmL1Block;

```

增加了Block Range记录L1上的block的extent信息, 一个range可能是一个extent， 也可能是一个extent内的一段连续的block。L1 Block上要维护了block range信息，那就不需要再记录每一个Data Block的Block ID了，只需要记录一个Block ranges。一个L1上最多支持16个range。

FreenessNode部分Oracle是按照bit来存储的，这部分先保留按照字节来存。

instanceId标识L1所属的实例id，初始化的时候设置为增加L1的实例的ID。

lastActiveTime表示L1上一次的活跃时间，修改L1的时候更新这个active time，具体用法并不明确，预留。

First Block表示改L1上Data Block的起始位置，这个之前的Block都是Meta Block， 有可能是Segment Block/ExtentMap Block/Ssm Block。

FirstFreeBlock表示第一个不是Full的DataBlock，目前没有用到，预留。

####   [5.2.2 并发控制](#522-并发控制)  

多个session在同一个L1上可能找到同一段range，format block的时候有两种方案：noread 模式：需要做并发控制，保证不会并发format 同一段block range， 否则可能会导致其他session已经format并且使用了的block被再次format.read   模式：读取要初始化的data block，已经被别人初始化过的data block不再初始化，第一个把range format完的session, 去L1 datablock上更新freeness range。

经过验证，read模式的方案有性能问题，在单机下，IO不好的磁盘上，会导致性能下降。采用方案一，依然用noread 模式format data block，在ssm dict上控制单实例上的并发在Ssm Dict上增加64个block id， 当format block range的时候，在ssm dict上登记这个range的start block id， 初始化完成之后，更新L1上的block range， 将对应ssm dict上的range block id设置成invalid此时如果其他session也找到了这个range，会看到ssm dict上有这个range block id， 会一直等待，等这个range被format完

**多实例并发控制**  多实例上控制format block range的并发，需要保证在format的时候，一个L1只属于一个实例format block range前，先给L1加上集群的共享锁再在Ssm Dict上记录range的block idformat完成之后，放集群锁

这个过程中，如果其他实例正在Steal这个L1， 需要给L1加上排它锁，如果有其他实例正在使用这个L1，那么排它锁就加不上，就无法steal， 会换一个L1 stealformat加上L1的共享锁之后，也会判断当前L1是否还属于本实例

###   [5.3 空闲空间查找](#53-空闲空间查找)  

空闲空间的三种查找方式不变

1. 从Search Entry开始的查找
1. 从Cache Block的L1开始的查找
1. 顺序查找


L3上查找L2的方式不变，基于freeness查找

####   [5.3.1 L2 Search](#531-l2-search)  

**随机查找**

1. 查找属于本实例的L1
1. 没有符合条件的本实例的L1
1. 缓存L2 Block到本地，基于缓存的L2 Block统计出Top 3的实例，根据每个实例上的L1个数，计算需要steal的count大于等于16个L1, steal 4个大于等于8个L1, steal 2个其他情况， steal 1个L1
1. 依次steal 需要被steal的实例上的L1
1. 再次search L2 block


**顺序查找**  Sequence Search L2

1. 先顺序查找符合条件的本实例的L1
1. 依次Steal每一个符合条件的，其他实例的L1并检查


####   [5.3.2 L1 Search](#532-l1-search)  

进入L1查找，首先要看L1是否还属于本实例，如果不属于本实例，则回到L2重新查找L1。

###   [5.4 Segment 扫描](#54-segment-扫描)  

segment上有extent map，基于segment的扫描是根据extent map以及segment上的高水位线信息，只扫描水位线以下的data block，根据extent map可以同步异步预读。

引入并发format data block， 高水位线以下就会存在未format的block，不能再基于extent map，按照extent，依次读取每个block了，需要引入低水位线， 低水位线以下是全部format了的，低水位线到高水位线之间的extent， 还要参考L1来判断是否需要读取， 只读取被format了的block。

![](https://pingcode.yasdb.com/atlas/files/public/67396a888970c2af4f51fe94/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUNCQUFBQUFBQUFBQUFBZ0FBQUFBQUFBRUFRQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBRUFBSUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTI0MjAsImV4cCI6MTc4MjIyMzIyMH0.1vVvdzAP68p2xPP9Hkdz4ohhNU-XnO2q-f_Qj7jDkx8)

####   [5.4.1 Auxillary Map](#541-auxillary-map)  

辅助Map的引入是必须的，基于Segment扫描高水位线到低水位线之间的Extent需要借助L1，因此当通过Extent Map拿到一个Extent之后，必须知道该Extent的起始L1在哪里，而且在分配L1部分，必须保证该Extent如果有多个L1，那么这多个L1必须是连续的，这样辅助Map就只需要记录第一个L1的位置就可以，L1上也会记录Extent的信息，通过L1上的Extent信息，就可以知道Extent有没有下一个L1，从而将整个Extent的Data Block通过L1访问完。辅助Map上还可以记录Extent的Data Block的起始位置，一个Extent上的元数据管理页面都在前面，剩下的都是Data Block，扫描低水位线以下的Exetnt，借助辅助Map可以只扫描Data Blocks。SSM Meta Block在SSM部分，也就是推水位线的时候才会分配，因此在Segment部分，辅助Map只是留有位置，并不会设置L1 Block和Data Block。

**兼容性**  Segment包括了Heap, Btree, Lob Segment，这三种Segment用到了SSM。

还有Swf, Spf Segment没有用到SSM的Segment。

引入本次的优化之后，Segment增加了辅助Map，要为Extent Map字段增加flags信息，标识是否包含Aux Map。为了统一Segment的管理，了以后的扩展，新增加一种Segment Block， 后续所有的Segment Block（包括Heap/Btree/Lob/Swf/Spf)都基于新的Segment Block创建， 增加Segment Type， 通过Segment Type识别是哪一种Segment。

所有的Segment Block都有reserved字段，在reserved部分新增了两部分扩展信息

```
typedef struct StSegmentBlockSup {
    CodUint8 segType;
    CodUint8 reserved[7];
} SegmentBlockSup;

typedef struct StExtentsMapSup {
    CodUint32 flags;
    CodUint8  reserved[12];
} ExtentsMapSup;

typedef struct StHeapSegmentBlock
{
    BlockHead       head;
    SegmentBase     base;
    ExtentsCtrl     extCtrl;
    AssmInfo        ssmInfo;
    CodUint8        reserved[232];
    SegmentBlockSup segBlkSup;      /* supplement to SegmentBlock */
    ExtentsMapSup   extMapSup;      /* supplentment to ExtentsMap */
    ExtentsMap      extentMap;
} HeapSegBlock;

```

当需要用到扩展字段的信息时，通过extCtrl上记录的extentMap的偏移位置，往前读取固定的位置获取扩展的两个结构。其他信息在新版本页面和旧版本页面上的位置保持不变。

通过Extent Map Head的Flags，标识Extent Map是否包括辅助Map。通过segType识别是那种类型的Segment。

ExtentMap Block因为没有预留字段，本次新增一种extent map block的block type

```
typedef struct StExtentMapBlockX {
    BlockHead      head;
    CodUint64      dataOid;
    CodUint32      ecn;
    ExtentsMapSup  extMapSup;
    ExtentsMapHead extMapHead;
    ExtentsMapNode mapNodes[0];
} ExtentMapBlockX;

```

####   [5.4.2 Low Hwm](#542-low-hwm)  

基于Segment的Scan， 如果包含了辅助Map， 通过辅助Map，低水位线以下的部分，可以只扫描Data Block低水位线以上的部分，通过L1s进行扫描，在Scan Range上要增加LowHwm的Location。当Scan Site的位置到达LowHwm的Location之后，通过L1s进行扫描，L1上维护有Extent信息，一样可以进行预读。

Ssm Search过程中不需要检测低水位线，在Segment Scan的时候才检测是否需要推低水位线，如果一直是索引加回表扫描，也不需要推低水位线。

SSM Segment Block上需要记录低水位线信息， 以及高水位线所在的L1 block的信息  **兼容性**  在SSM Segment Block的reserved字段部分扩展以下信息：

```
typedef struct StSsmInfoSup {
    CodUint16      nodeId;
    CodUint16      unused;
    ExtentsLwm     lwm;
} SsmInfoSup;

```

在需要获取扩展字段的时候，也可以通过获取extCtrl上记录的extentMap的偏移位置，往前读取固定的位置获取新增的结构。

除了低水位线，Oracle在Segment上还记录了部分还记录了一些ASSM相关的信息：

- First L3： 因为Oralce的Segment Block充当了第一个L3，Segment上记录First L3是为了标识除了当前Segment Block外，有没有别的L3，L3 BMB上会记录next L3。YashanDB采用的是L3独立于Segment Block的方式，因此不需要在Segment Block上记录First L3。
- HWML1： 高水位线所在的L1，Oracle是整个segment， 无论是在高水位线之上还是之下，每个extent都有完整的ssm meta block，在L2上查找L1的时候，只查找高水位线以下的L1，所以需要记录HWML1，YashanDB也记录了HWML1，但是YashanDB记录HWML1是为了在并发扩展Segment的时候确定是否有其他session已经推过hwm。
- LowHwm L1:  猜测是用于Segment Scan。


First L3和LowHwm L1信息是否要持久化到SsmInfo里在开发过程中再看是否有必要添加。

###   [5.5 Map Tree](#55-map-tree)  

####   [5.5.1 结构变化](#551-结构变化)  

Map Tree从一棵树改为森林，即有多个L3，这样设计是因为L1上不再是满了以后才申请下一个L1， 如果继续保持只能有一个L3， 那么Segment大小的上限就无法预估，如果可以有多个L3，Segment的上限就不会受到Ssm的限制，而是跟Segment统一，只受Segment Extent Ctrl伤的block count影响。L3 Block增加next字段

```
typedef struct StAssmL3Block {
    AssmBlockHead ssmHead;
    SpaceBlockId  next;
    SpaceBlockId  nodes[SSM_BLOCK_MAX_CAPACITY];
    CodUint8      frnsNode[SSM_BLOCK_MAX_CAPACITY];
} AssmL3Block;

```

Oracle在L3上并没有记录L2的freeness， 且Segment Block也充当了第一个L3 Block， YashanDB的L3是独立于Segment Block的，这个设计依然保留，Ssm Meta Block记录下一层Block的Freeness这点也保留，预留字段加上version信息， 对于新版本的Ssm Meta Block， 去掉加速数组。

####   [5.5.2 Extend Ssm Tree](#552-extend-ssm-tree)  

当在高水位线以下找不到符合freeness的Data Block， 需要扩展Ssm Tree时， 首先查看Segment高水位线以上是否还有Extent， 如果没有就先扩展Segment。

在Ssm Tree部分，则需要以下步骤来扩展：

首先，根据Segment的大小，计算该Extent需要分配的L1数量。单个L1可容纳的blocks数量受当前segment大小约束，另外，为了避免单个L1记录的extent数量过多，造成该L1上竞争太大，因此约束单个L1最多记录16个extent（或者说16个range）。L1可容纳的blocks数量与segment大小的关系，如下表所示。

|segment大小（单位：MB）|单个L1可容纳的blocks数量（单位：个）|L1可容纳的extent数量（单位：个）|
|---|---|---|
|（0,1]|16|16|
|(1，64]|64|16|
|(64，1024]|256|16|
|(1024，segment最大尺寸)|1024|16|


假设当前L1已容纳N1个block，M个extent，当前新扩展的extent的大小是N2个block。根据上表，确定单个L1可容纳的blocks数量N，然后可确定是否需要分配L1，及需要的话，分配多少个L1.

- 如果N1 + N2 <＝ N，且M + 1 <＝ 16，则不需要新分配L1，令当前L1管理新扩展的extent。
- 否则，为新extent分配L1，L1的个数＝Ceiling(N2/N)，也就是N2/N上取整。


例如，对于自动扩展的segment，Segment是按照8， 128， 1024， 8192的extent size，逐步增大extent的，对于8个block的extent， 两个extent共用一个L1， 对于128的extent 一个extent申请2个extent，1024的extent分配4个extent， 8192的extent分配8个L1。

|Segment Size|Extent Size|L1 Blocks|L1 Count|
|---|---|---|---|
|小于1M|8|16|1/2|
|小于64M|128|64|2|
|小于1G|1024|256|4|
|unlimited|8192|1024|8|


确定了L1的数量之后，就要看L2上的空间是否足够，再决定是否要申请新的L2，以及是否要申请L3。

初始化L1/L2/L3，推高水位线是要通过原子操作来保证原子性，并要防止这个过程与重启回滚操作访问页面造成死锁。

原则就是，将需要初始化的页面先全部初始化，这个过程中，不要将初始化的页面挂到Ssm Tree上，

- 首先初始化L1 Blocks。
- 如果需要初始化L2 Block， 接着初始化L2 Block， 再将需要加到L2上的L1先加入新的L2。
- 如果如果需要初始化新的L3，接着初始化L3， 再将新的L2加到新的L3上。


在这个过程中，所有需要初始化的Block都已经初始化过，如果发现某个Block正在被其他线程X锁占用着，肯定是因为数据库重启回滚造成的，就可以提前结束原子操作。然后开启新的原子操作，接着初始化。当所有的Block都初始化之后，再将这些Block加入Ssm Tree中。已经初始化过的Block，因为上面有Data Oid，所以不会再与重启回滚部分再造成死锁了。

最后在一个原子操作中，将新增的SSM Meta Block挂到Ssm Tree上。

加入Ssm Tree的过程是：

- 将L1s 加入到Current L2
- 将新增的L2加入到Current L3
- 将新增的L3与Last L3关联起来
- 更新高水位线
- 结束原子操作。


这个过程中，不可能再出现跟其他操作页面死锁的场景。

这样就能保证，在所有的Meta Block初始化之前，原子操作是可以结束的，因为水位线没有推，而且Meta Block也没有加入到Ssm Tree里。

####   [5.5.3 Truncate/Shrink Segment](#553-truncateshrink-segment)  

Trncate的逻辑保持不变，将整个Segment Free之后重新创建

Shrink部分则需要调整，因为Ssm Block上维护了Extent信息，则可以通过Ssm进行倒序扫描，因为L1上有range信息，可以实现预读，还可以同时维护Ssm Path信息。

且因为会有多个L3， Ssm Tree Shrink部分也需要做调整。

###   [5.6 DFX](#56-dfx)  

####   [5.6.1 新增等待事件](#561-新增等待事件)  

1. format block range等待
1. L1 Block锁等待事件


####   [5.6.2 新增统计信息](#562-新增统计信息)  

1. steal L1的次数


##   [6. TODO（遗留问题）](#6-todo遗留问题)  

当前还未实现多个L3， segment的大小依然是受到三层SSM的限制，从用户角度感知不到这个变化，但是在extent size比较小的时候，按照最小计算，一个extnt size为8， segment扩展到1T就会报错达到上限。

## Attachments: