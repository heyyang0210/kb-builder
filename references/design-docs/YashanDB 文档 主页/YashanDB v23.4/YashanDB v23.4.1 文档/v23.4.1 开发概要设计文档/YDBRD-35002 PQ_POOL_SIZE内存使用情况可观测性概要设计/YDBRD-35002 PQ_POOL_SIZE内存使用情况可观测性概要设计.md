1. channel使用的内存分配函数收编，原有能力两部分：
    1. 固定大小对象快速分配（ChnBuff） 原调用 mCacheAlloc
    1. 连续内存分配（dataBuffer） 原调用 mBuddyAlloc
1. AniChannel上封装内存分配器结构：
    1. ChnMemContext
1. 新增 MEM_TAG_PQ_POOL 用于记录PQ_POOL分配配额
1. 视图新增对应MEM_TAG_PQ_POOL的输出


当前channel使用存在三个并发线程线程：  
worker 线程申请、释放
ics receiver线程收到ack时释放
channel background sender 发送后释放

channel fragment原来直接使用buddyBolckCtrl，上面使用refCount用于判断是否还有被引用，增加结构ChnDataBuf用于管理数据缓存的内存，记录refCount和bufSize

mem handle只能是一个线程使用，不能并发，如果是mem handle A申请，mem handle B释放，这样是可以的。

展示使用mTag展示  
需要在分配和释放时调用mTagAllocMem和mTagFreeMem更新统计值（需要加锁）