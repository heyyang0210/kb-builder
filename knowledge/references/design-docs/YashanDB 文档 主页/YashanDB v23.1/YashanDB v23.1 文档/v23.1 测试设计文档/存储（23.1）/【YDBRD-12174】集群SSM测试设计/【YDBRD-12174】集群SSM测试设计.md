Created by 郑荃, last modified on 十一月 08, 2023

# **1. 概述**

本文描述SSM支持多实例  的测试设计 

# **2. 需求分析**

SR：    [YDBRD-13419](https://jira.yasdb.com/browse/YDBRD-13419?src=confmacro)    -  SSM支持并发初始化页面  完成    [YDBRD-13425](https://jira.yasdb.com/browse/YDBRD-13425?src=confmacro)    -  SSM支持多实例空间分配  完成    [YDBRD-13426](https://jira.yasdb.com/browse/YDBRD-13426?src=confmacro)    -  SSM支持基于L1的segment扫描  完成    [YDBRD-13427](https://jira.yasdb.com/browse/YDBRD-13427?src=confmacro)    -  shrink table适配ssm优化  完成

开发设计：    [SSM支持多实例空间分配](100087920.html)  

### 2.1新版本SSM和旧版本SSML的区别的主要差异

- 旧版本一次只申请一个L1，新版本上一次可能申请多个
- 旧版本L1上都是Format过的datablock  ，  不会有Meta Block.    新版本上存在未初始化的Data Block，Farmat会分散到各个等待的session上，待空闲空间查找时进行，存在  Meta Block
- 旧版本Format Blocks和Blocks挂到L1上这个过程必须是串行的，新版本将两个流程拆开，format的流程可以并发
- 新版本引入低水位线，低水位线以下是全部format了的，低水位线到高水位线之间的extent， 还要参考L1来判断是否需要读取， 只读取被format了的block


### 2.2共享集群SSM存在的问题

1、  共享集群在多实例一起导入数据时，页面冲突太大，在空闲空间元数据管理页面，数据页面上都存在冲突，这就导致两实例总是在互相请求最新页面。 从TPCC两实例导入100仓数据的数据来看：192.168.3.104 192.168.3.109 单实例100并发导入100仓数据：1m30s 两实例100并发导入100仓数据：14m+ 优化思路：降低SSM元数据页面和数据页面在共享集群上的页面冲突，可以将SSM L1页面按实例划分，每个实例从L2上找到自己实例的L1。

2、  共享集群下导入数据时，segment extending的等待时间在变得更长，共享集群下attach block的时间比单机慢，这就导致ssm扩展的时候，会花费更多的时间，ssm不能并发扩展，其他session都只能等待。 优化思路：缩短ssm扩展的时间，将format data block的时间分散到各个等待的session上。

基于上述优化  现有SSM存在两个问题：

- **问题一：不能并发Format Block**
- **问题二：L1冲突大**


  


### 2.3  **ASSM Segment 扩展**

**本次通过新的SSM框架，即ASSM（Auto Segment Sapce Management）实现以下能力：**

**L1上支持并发Format Block**     L1上要支持并发Format Block，就要把未初始化的Data Block也记录到L1上，Data Block的Parent L1以及在L1上的位置就是确定的，空闲空间查找的时候，找到未初始化过的Block，按照Group，一次初始化一批Block， 再更新这批Block在L1上空闲度。

**多个可用L1**

L1不需要满了再分配下一个L1，在Extent Size较小的时候，每扩展一个Extent， 多分配几个L1。

**L1按实例划分**     L1划分到实例上，本实例优先用属于自己实例的L1， 没有可用L1，去别的实例上steal L1.

  


ASSM 将原来SSM扩展的流程拆分成了两个流程，ASSM扩展和Format Data Block

#### 2.4.1 ASSM 扩展流程

只涉及ASSM元数据页面的修改， 一次扩展一个Extent，只为新扩展的Extent分配SSM Meta Block，减少了SSM Extend的时间，

1. 按照分配规则，计算extent需要的L1数量，1024大小的L1需要4个L1
1. Format 4个 L1, 这个4个L1的instance id为当前扩展ssm的实例ID，每个L1一次记录extent上的256个block，freeness为unformat状态，第一个L1记录的前4个Block为L1 Block，在L1上的freeness为0， 即FULL Block。
1. 将New的4个L1 Block记录在L2上
1. 更新segment block上的ASSM Info，以及新的高水位线和高水位线所在的L1 block


#### 2.4.2Format Block的流程

将原来Format Data Block的动作拆分出来，在空闲空间查找的时候进行。可以多个session同时format不同的block range。 通过L3 -> L2 -> L1找到对应实例的L1

1. 在L1上随机查找Data Block， 如果找到一个未初始化的Data Block，则记录下这个这个Data Block所在的group， 一个group为16个block
1. 初始化这个group所在的data block
1. 更新对应的L1上的freeness range


format group划分： 如果一个extent不足16个block，这个extent就是一个format group 如果extent大于16， 则每16个block一个group， 最后剩下的不足16个的block一个group。

### 2.4.2 并发控制

1、多实例并发控制：多个session在同一个L1上可能找到同一段range，需要做并发控制，保证不会并发format 同一段block range， 否则可能会导致其他session已经format并且使用了的block被再次format。在ssm dict上控制单实例上的并发 在Ssm Dict上增加64个block id， 当format block range的时候，在ssm dict上登记这个range的start block id， 初始化完成之后，更新L1上的block range， 将对应ssm dict上的range block id设置成invalid 此时如果其他session也找到了这个range，会看到ssm dict上有这个range block id， 会一直等待，等这个range被format完

2、多实例并发控制     多实例上控制format block range的并发，需要保证在format的时候，一个L1只属于一个实例 format block range前，先给L1加上集群的共享锁 再在Ssm Dict上记录range的block id format完成之后，放集群锁。

这个过程中，如果其他实例正在Steal这个L1， 需要给L1加上排它锁，如果有其他实例正在使用这个L1，那么排它锁就加不上，就无法steal， 会换一个L1 steal format加上L1的共享锁之后，也会判断当前L1是否还属于本实例

### 2.5 空闲空间查找

空闲空间的三种查找方式不变

L3上查找L2的方式不变，基于  freeness查找

L2查询找，先找属于本实例的L1，没有符合本实例的L1，会去其他实例上窃取

### 2.6 Extend Ssm Tree

当在高水位线以下找不到符合freeness的Data Block， 需要扩展Ssm Tree时， 首先查看Segment高水位线以上是否还有Extent， 如果没有就先扩展Segment。

在Ssm Tree部分，则需要以下步骤来扩展：

首先，根据Segment的大小，计算该Extent需要分配的L1数量。单个L1可容纳的blocks数量受当前segment大小约束，另外，为了避免单个L1记录的extent数量过多，造成该L1上竞争太大，因此约束单个L1最多记录16个extent（或者说16个range）。L1可容纳的blocks数量与segment大小的关系，如下表所示。

|segment大小（单位：MB）|单个L1可容纳的blocks数量（单位：个）|L1可容纳的extent数量（单位：个）|
|:---|:---|:---|
|（0,1]|16|16|
|(1，64]|64|16|
|(64，1024]|256|16|
|(1024，segment最大尺寸)|1024|16|


假设当前L1已容纳N1个block，M个extent，当前新扩展的extent的大小是N2个block。 根据上表，确定单个L1可容纳的blocks数量N，然后可确定是否需要分配L1，及需要的话，分配多少个L1.

- 如果N1 + N2 <＝ N，且M + 1 <＝ 16，则不需要新分配L1，令当前L1管理新扩展的extent。
- 否则，为新extent分配L1，L1的个数＝Ceiling(N2/N)，也就是N2/N上取整。


  


# **3. 测试**  **设计方法**   

主要采用场景法和错误分析法来进行测试设计

**测试范围：**

- segment类型覆盖：heap、btree、lob 、Swf, Spf Segment没有用到SSM的Segment
- 表类型：分区表和普通表（重点覆盖）、临时表（简单覆盖）
- 部署形态：单机（SSM结构有一些变化，看一下基本的功能是否有问题，涉及用例结果的刷新），集群（集群本次shrink table是拦截，后面的SR会适配shrink table功能）
- 页面大小：8k、16k、32k
- 扫描方式：全表扫描、索引扫描、回表的方式
- 空闲度覆盖：数据大小覆盖不同空闲度空间查找
- 性能：数据导入性能（单实例、多实例）、TPCC性能
- 升级：升级后SSM结构会发生变化，升级前以后有的segemen走原流程
- 视图变更：V$SYSTEM_EVENT、V$SYSTEM_WAIT_CLASS新增等待事件


**观测手段：**

- DBA_SEGMENTS视图
- 页面解析信息正确
- V$SYSSTAT：SSM相关的统计项


**场景：**

1、推低水位线

- 全表扫描（推低水位线）
- index fast full scan（推低水位线）
- index full scan（不推低水位线）
- 索引回表（不推低水位线）


2、存储属性

- 创建表时使用默认的存储参数（使用所在表空间的默认存储参数）
- 创建表时使用自定义的存储参数
- 修改存储属性
- extent按照固定的block进行扩展（8个、256个、1024个）
- extent 自动扩展


3、占满表空间，插入/更新数据后，不能扩展，触发 extend segment

4、并发：

- 并发场景为多实例+多session同时并发
- 高并发DML(insert,update,delete)，产生大量extend segment申请
- L1扩展触发L2扩展（有数据的插入和从小到大更新）
- 同一个事务中多次插入删除数据复用data block


### 专项覆盖

|专项|是否涉及|说明|
|:---|:---|:---|
|并发|涉及|  
|
|长稳|/|  
|
|一致性|涉及|  
|
|三方测试工具    
  (sqltest，sqlancer)|/|  
|
|安全|/|  
|
|DFR/testkill|涉及|  
|
|HA|/|  
|
|压力|/|  
|
|性能|涉及|  
|
|可维护性|/|  
|
|兼容性|/|  
|
|升级|涉及|  
|


# 4.   **详细测试设计**   

[ASSM.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTQ4OTcwYzJhZjRmNTFmYjFjIiwicmVmX2lkIjoiNjczOTY5ZTQ3MjgyMDZlZmI5MmVmOGFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5ODA2LCJleHAiOjE3ODIyOTYyMDZ9.Is2DiBmQFVyNseKOOwvDgQ0i4Ul00KltEapE78mMpXQ)

# 5.   **测试用例**

[ASSM测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTQ4OTcwYzJhZjRmNTFmYjFkIiwicmVmX2lkIjoiNjczOTY5ZTQ3MjgyMDZlZmI5MmVmOGFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5ODA2LCJleHAiOjE3ODIyOTYyMDZ9.ByUeN7c_wfYItjNLW3fwQ0CFw507qP9LgdKm7via5J4)

# 6.   **测试框架设计**

自动化用例添加到regress框架

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[支持ROWID数据类型测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTQ4OTcwYzJhZjRmNTFmYjFlIiwicmVmX2lkIjoiNjczOTY5ZTQ3MjgyMDZlZmI5MmVmOGFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5ODA2LCJleHAiOjE3ODIyOTYyMDZ9.nYG7_KCJ5gfGB1DVNjjsFECECztzk1ot26mMCj9Igz8)

 (application/vnd.xmind.workbook)    


[ASSM.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTQ4OTcwYzJhZjRmNTFmYjFjIiwicmVmX2lkIjoiNjczOTY5ZTQ3MjgyMDZlZmI5MmVmOGFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5ODA2LCJleHAiOjE3ODIyOTYyMDZ9.Is2DiBmQFVyNseKOOwvDgQ0i4Ul00KltEapE78mMpXQ)

 (application/vnd.xmind.workbook)    


[ASSM测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTRhMWFkOWEzMzExZGM3OTkyIiwicmVmX2lkIjoiNjczOTY5ZTQ3MjgyMDZlZmI5MmVmOGFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5ODA2LCJleHAiOjE3ODIyOTYyMDZ9.OQq7Ys9f8pM50dvSc4ssvAhdoXPmYWbhPmx5XSr2wqY)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[ASSM测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZTQ4OTcwYzJhZjRmNTFmYjFkIiwicmVmX2lkIjoiNjczOTY5ZTQ3MjgyMDZlZmI5MmVmOGFlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5ODA2LCJleHAiOjE3ODIyOTYyMDZ9.ByUeN7c_wfYItjNLW3fwQ0CFw507qP9LgdKm7via5J4)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
