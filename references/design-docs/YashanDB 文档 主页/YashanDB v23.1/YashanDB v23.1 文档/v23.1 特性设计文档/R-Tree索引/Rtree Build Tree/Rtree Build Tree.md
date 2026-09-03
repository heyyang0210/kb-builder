Created by 张锐, last modified on 七月 19, 2023

##   [Rtree Build Tree](#rtree-build-tree)  

Rtree Build Tree需要尽可能的采取一种划分，将逻辑上比较接近的key划分到一个block，一层一层向上聚集，形成一个完整的Rtree。

假设根据index定义，算出来一个leaf block可以包含n个key，初始key的总个数是R，则根据R和n的关系，我们有3种build tree的策略。

###   [1. Build No Action](#1-build-no-action)  

当R <= n时，将所有的key放在一个block，这个block就是rtree的root。

###   [2. Build Cluster](#2-build-cluster)  

当n < R <= 2n时，我们可以采取分裂算法来build tree，分裂算法参考    [Rtree分裂算法](https://conf.yasdb.com/pages/viewpage.action?pageId=104210467#rtree%E5%88%86%E8%A3%82%E7%AE%97%E6%B3%95)    。

###   [3. STR](#3-str)  

当R > 2n时，我们采取STR(Sort-Tile_Recursive)算法来build rtree。假设Rtree是d维的，我们使用一个d维MBR的mean坐标（即每个维度的中心点）来计算，算法步骤为：

-     1. 取i=1

-     1. 将R个MBR按照第i维度排序，并拆分为S个分组

-     1. i++，将每个分组重复步骤2，直到i=d

-     1. 此时已经将R个MBR拆分成了S^d个分组

-     1. 将每个分组依次落盘其中：



![](https://pingcode.yasdb.com/atlas/files/public/67396a428970c2af4f51fd61/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTIyNjgsImV4cCI6MTc4MjIyMzA2OH0.u1ffYOP4jI4xAbGWryKGbhC3JoTH91TKsfcOMn9VULI)

代码流程如下：

- 将所有MBR插入mtrl
- 按照第一个维度，降序排序
- 进入buildDimension流程，currDim为1
- 假设当前mtrlCtx中存在N个key，for循环S次，buildDimension每次从当前mtrlCtx中从后面摘取N/S个key，放入一个新的mtrlCtx
- 取出来后进入buildDimSlice流程， 传入的curDim = curDim + 1
- buildDimSlice首先按照当前维度重新排序（降序），排序后，如果currDim是最后一个维度，则倒序从mtrlCtx扫描数据，build tree
- 否则进入buildDimension流程
- 递归结束后，做finishBuildTree，将每个level还在内存中的block，自底向上生成parent key插入parent
- 把内存中的block落盘


## Attachments: