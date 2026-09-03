Created by 马志宏, last modified by  张锐 on 十一月 03, 2023

## 1. Overview（概述）

      集群中某个实例crash之后，master实例会帮该实例回放redo，将脏页恢复出来，恢复业务。

## 2. Features（功能特性）

- 在线回放支持并行回放，按页面id哈希到多个后台回放线程，加快回放
- 在线回放支持流水线，在回放上一批redo的时候，同时读取下一批redo
- 要考虑同时reform多个实例，即多实例redo的归并排序


## 3. Interfaces（接口）

  


## 4. Limitations（功能限制）

1. 申请redo load buffer失败，或者启动后台线程失败，则报错退出
1. redo损坏，回放不到一致性点则报错


## 5. Detail Design（详细设计）

### **5.1 总体流程**

![](https://pingcode.yasdb.com/atlas/files/public/67396b4ca1ad9a3311dc81e3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTI3ODEsImV4cCI6MTc4MjMwMzU4MX0.eDFJvSNeEVeDiYQ-bbXoxRBzW_xwaCO77SFNNZHe3aI)

1. 根据待恢复的实例ID，初始化对应的RcyInstManager，申请对应buffer，其余的RcyInstManager 直接设为无效
1. 第一阶段，从回放开始点，加载对应实例的redo，然后进行block分析，构造recovery set，直到redo全部遍历完毕
1. 第二阶段，从回放开始点，加载对应实例的redo，进行block哈希分配，然后触发后台并行回放线程，去回放，直到redo全部遍历完毕
1. 将回放产生的脏页全部刷盘，更新rcy begin point
1. 释放RcyInstManager


```
typedef struct StRecoveryManager{
    ...省略...
    RcyInstManager   instm[ANK_MAX_INSTANCES];
} RecoveryManager;

```

### 第一阶段细节

#### redo预分析流程

- 分配RcyBufferPool，init RcyBufferCtrl，使用hash表结构
- 循环调用rcyFetchGroup，扫描redo(双buffer，一个线程load group，一个线程analyze)
- 发现一个block，就加入RcyBufferPool，更新lastLsn，如果是第一次加入，记录firstLsn
- 当发现RcyBufferPool满了后，优先去扩，扩不出来再进入下一个处理流程
- RcyBufferCtrl与dataBufferCtrl一一对应，但是RcyBufferCtrl的ctrl指针可以是NULL
- 如果需要的页是一个master的past copy，不能直接把past copy的ctrl赋值给rcyCtrl，需要重新申请一个新的ctrl，把past copy拷贝过去
- 当发现RcyBufferPool满了后，记录当前日志点，打标记（说明当前RcyBufferPool已满），后续新的block也不加入RcyBufferPool，继续扫描redo，完成当前RcyBufferPool中的block的扫描
- 调用grc接口，给RcyBufferPool中的block加全局recovery lock，并标记
- 重新从记录的redo点扫描，淘汰已经加锁了的RcyBufferCtrl
- 当所有恢复集的block都加锁后，发消息给grc


  


#### 恢复集页面加锁

- 如果存在current block S锁，则说明crash instance不可能持有当前block的脏页，并且当前页面可用，reform线程直接刷
- 如果存在current block X锁，则说明crash instance不可能持有当前block的脏页，但是当前页面是否可用不能判断，标记，等回放结束后，在通过attach接口刷一遍标记的block
- 不存在current block，但是存在past copy，需要看past copy和磁盘谁的lsn新，如果最新lsn >= block的last-dirty-lsn,则这个block可以标记finish，否则需要回放（从最新的lsn的block开始回放）
- 没有current block也没有past copy，如果磁盘的block的lsn >= block的last-dirty-lsn,则说明这个block已经包含了crash instance的修改，则这个block可以从标记finish，否则需要回放


  


```
typedef struct StRecoveryBufferCtrl {
    BufferCtrl* ctrl;
    BlockId     bid;
    CodUint32   firstLsn;
    CodUint32   lastLsn;
    CodUint32   rcyNext;
    CodUint32   rcyPrev;
    CodBool     locked;
    CodUint8    unused[3];
} RcyBufferCtrl;

typedef struct StRecoveryBufferPool {
    RcyBufferCtrl* first;
    RcyBufferCtrl* last;
    RcyBufferCtrl* dirty;
    CodUint32      cnt;
    CodUint32      firstLsn;
    CodUint32      lastLsn;
} RcyBufferPool;

// redo预处理阶段，申请一个RcyBufferCtrl
CodResult bpAllocRcyBuffer(AnkHandler* handler, BlockId blockId, RcyBufferCtrl** ctrl);
// grc根据最新block（最新past copy或者磁盘block）状态，决定是否加锁当前block。如果从恢复集丢弃，则不加锁，当前ctrl释放；如果需要加锁，则从buffer申请ctrl并摘链挂到rcyBufferPool，拿到适当的datablock
CodResult bpLockRcyBlock(AnkHandler* handler, RcyBufferCtrl* ctrl, RcyBufferPool* rcyBufferPool);
// 在线恢复应用redo的时候，attach rcy block，从rcyBufferPool attach block，首先从RcyBufferPool找到RcyBufferCtrl，如果没有，则触发清理，换入换出一个rcyCtrl。如果rcyCtrl里的bufferCtrl是NULL，则去磁盘读
CodResult bpAttachRcyBlock(AnkHandler* handler, BlockId blockId， RcyBufferCtrl** ctrl);

```

  


### 第二阶段细节

#### 回放

1. 在线并行回放与重启并行回放尽量共用一套逻辑，因此在线并行回放也会对group进行归并排序，不过目前只会有一个实例的redo是有效的
1. 后台回放线程，  **attach block，detach block的逻辑要独立一套**
1.     - attach后的block要放在recovery buffer内，即使执行实例有past copy，也不能共用一个block，必须拷贝一份
    - detach后，不需要挂到普通脏页队列

1. 回放过程中，不需要推点，即不用更改crash实例的rcy begin和flush point
1. DDL日志是否需要回放？
1. 表空间redo必须回放
1. 当所有恢复集页面恢复完成后，推crash instance的RCY点


#### Buffer与RcyBuffer

1. RcyCtrl与bufferCtrl一一对应，bufferCtrl增加标记inRecovery
1. 挂到RcyCtrl的bufferCtrl，都是新申请的ctrl，不挂bufferPool的链（或者挂，rcycle的时候跳过inRecovery的ctrl）
1. RcyBufferPool换入换出，根据LRU落盘一个rcy脏页（根据落盘lsn，通知past copy失效）


#### 脏页队列

1. 独立的recovery脏页队列，  **不需要维护truncPoint，不需要推点**  ，所以不需要实时刷盘，只有以下情况才刷盘：
1.     - 页面已经回放到last lsn状态，则进行刷盘，并释放该页面的锁
    - recovery buffer空间不足，需要淘汰某个recovery页面的时候，进行刷盘

1. 因此recovery脏页队列不是在回放页面的时候挂链，而是在  **第一阶段分析页面的时候就可以挂链**  ，并且最好按照last lsn升序排列，这样位于head的页面是最早刷盘的
1. 脏页刷盘，可以启动多个线程加速刷盘
1. 淘汰页面的算法是否采用LRU，如果采用的话，怎么维护这个LRU？
1. 单独的DBWR线程（RCYDBWR），定时去遍历RcyBufferPool的脏页链，刷脏页，通知grc放锁
1. 在线恢复流程启动时，启动RCYDBWR，完成时退出RCYDBWR


## 6. Testcases（用例）

## 7. Workload（工作量）

1. 评估代码量KLOC = xxx行
1. 评估工作量 =xxx（人天）


## 8. TODO（遗留问题）

故障实例的事务在在托管完成前。不能访问。

  


## Attachments:

[image2023-7-13_20-9-22.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNGNhMWFkOWEzMzExZGM4MWUxIiwicmVmX2lkIjoiNjczOTZiNGI1OTNmOTljOWZmMjM2MDhjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyNzgxLCJleHAiOjE3ODIzNzkxODF9.hqhjbinZwcHP_w6OkuOZ4PPdm41dVGslVnIwP6k8tZo)

 (image/png)    
