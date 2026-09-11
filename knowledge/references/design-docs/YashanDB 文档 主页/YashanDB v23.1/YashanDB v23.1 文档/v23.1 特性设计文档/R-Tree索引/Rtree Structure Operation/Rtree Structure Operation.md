Created by 张锐, last modified on 六月 26, 2023

##   [Rtree Structure Operation](#rtree-structure-operation)  

rtree的结构性变更有如下几种：

- 扩大路径MBR
- 分裂
- 缩小路径MBR
- compact


与btree相同的是，rtree的结构性变更需要开启自治事务，并且使用block的0号xslot。

###   [1. 调整路径MBR](#1-调整路径mbr)  

- 查找插入位置的时候，如果途径的branch节点由于要插入的MBR而扩大，则我们在插入MBR前，要自底向上的扩大这条路径的MBR
- 在compact with undo完成后，我们需要判断compact前后，当前block的MBR是否缩小，如果缩小了，则我们要在compact这个自治事务中，自底向上的缩小这条路径的MBR


这两种场景对于parent MBR的调整逻辑相同，只是一个是扩大，一个是缩小。所以在代码层面使用一套代码，判断是否扩大/缩小，改为判断是否变化。调整路径MBR的流程如下：

- 计算当前leaf block的新MBR，如果发生了变化则触发调整
- 在上一层，判断是否在向下查找时，路过当前页面之后，当前页面是否发生结构性变更，如果发生了变更，则要触发重找，并lock xslot0
- 使用新的MBR更新老的MBR
- 更新完后，判断这一层是否需要调整，如果需要，则继续向上调整直到不需要调整或者到了root


###   [2. Compact](#2-compact)  

不计undo的compact，rtree与btree完全一样，对于需要记undo的compact，物理的compact操作rtree与btree完全一样，但是在compact完成后，rtree需要判断是否需要向上调整路径MBR。

rtree compact with undo的流程如下：

- lock当前leaf block的0号xslot
- 做compact，同时生成compact前后的MBR
- 判断compact前后的MBR是否发生变化，如果发生变化则进入    [调整路径MBR](https://conf.yasdb.com/display/YAS/Rtree+Structure+Operation#1-%E8%B0%83%E6%95%B4%E8%B7%AF%E5%BE%84mbr)  
- 结束


###   [3. Split](#3-split)  

如果插入的key插入不到查找到的block，则需要分裂，分裂流程如下：

- lock当前leaf block的0号xslot
- 生成当前block的parent key（MBR）
- 生成当前block的MBR划分（连带待插入MBR一起考虑，划分算法参考    [Rtree分裂算法](https://conf.yasdb.com/pages/viewpage.action?pageId=104210467#rtree%E5%88%86%E8%A3%82%E7%AE%97%E6%B3%95)    ）
- 根据划分结果，生成2个部分的2个parent key（MBR）
- split block
- 判断当前block是否是root，如果是root则结束
- 调整当前block的parent block，详见     [3.3](https://conf.yasdb.com/display/YAS/Rtree+Structure+Operation#33-split-block%E5%90%8E%E7%9A%84parent%E8%B0%83%E6%95%B4)  
- 调整完后，如果不需要继续split，则判断是否需要向上调整MBR，如果需要调整则进入    [调整路径MBR](https://conf.yasdb.com/display/YAS/Rtree+Structure+Operation#1-%E8%B0%83%E6%95%B4%E8%B7%AF%E5%BE%84mbr)    ，否则结束
- 如果需要继续split，则保存当前level的待插入parent key，继续split当前block
- split完成后，判断是否需要插入当前level的待插入key，如果需要则插入
- 进入判断当前block是否是root的步骤


####   [3.1 非root block的分裂](#31-非root-block的分裂)  

- 根据划分，将划分到右边的key组合起来，format一个新的block（leaf block，如果待插入key被划分到新block，则这个key不能format进新block；branch block可以把待插入key format进新block）
- split curr block，把搬迁走的key erase掉


####   [3.2 root block的分裂](#32-root-block的分裂)  

- 根据划分，format2个新的block（如果root是leaf block，不管划分到哪个block，待插入key不能format进去；branch block可以format进新block）
- root重新init为包含2个parent key的root，并且level++(2个parent key分别指向了2个新format出来的block)


####   [3.3 split block后的parent调整](#33-split-block后的parent调整)  

一个block split后，生成了3个MBR：

- old parent，当前block split前的MBR
- new parent，当前block split后的MBR
- parent key，当前block split出来的new block的MBR


split block后需要将当前block的parent block中对应的key update为new parent，并且把parent key插入parent block中。分析可得update操作不会产生额外的空间开销，所以我们先update，然后再insert，流程如下：

- 进入parent block，判断parent block与查找的时候是否发生结构性变更，如果发生了结构性变更，则拿着old parent，从root重找（重找前可以在当前block尝试查找一次，因为大概率还在当前block）
- lock 0号xslot
- 生成当前block的old parent
- 使用new parent做update
- 判断parent key是否可以插入当前block，使用一个bool变量needSplit做判断
- 如果需要split则拷贝当前block，流程结束，外层进入split流程
- 否则，parent key可以插入当前block，判断更新后，新的parent MBR是否发生变化（新的MBR生成需要同时考虑new parent和parent key），使用一个bool变量needUpdate做判断
- 如果发生变化，则将新的MBR拷贝进new parent
- 将parent key插入当前block
- 外层判断!needSplit && needUpdate，进入    [调整路径MBR](https://conf.yasdb.com/display/YAS/Rtree+Structure+Operation#1-%E8%B0%83%E6%95%B4%E8%B7%AF%E5%BE%84mbr)    流程
