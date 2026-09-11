Created by 李嘉瑞, last modified by  王若琳 on 四月 12, 2023

#   [YDBRD-7671 : Binary-heap Design（Binary-heap方案设计）](#ydbrd-7671--binary-heap-designbinary-heap方案设计)  

SR链接：    [https://jira.yasdb.com/browse/YDBRD-7675](https://jira.yasdb.com/browse/YDBRD-7675)  

##   [1. Overview（概述）](#1-overview概述)  

- 整改开源库，去掉crab中的Binary-heap和compare依赖


##   [2. Features（功能特性）](#2-features功能特性)  

- 实现Binary-heap，替换掉crab中使用的Binary-heap库和compare库
- Binary-heap为二叉堆，可作为最大堆使用，也可以作为最小堆使用


##   [3. Interfaces（接口）](#3-interfaces接口)  

```
pub fn from_vec_with_cmp(vec: Vec&lt;T&gt;, cmp: C) -&gt; Self;
pub unsafe fn replace_cmp_unchecked(&amp;mut self, cmp: C, rebuild: bool);
pub fn is_empty(&amp;self) -&gt; bool;
pub fn push(&amp;mut self, item: T);
pub fn pop(&amp;mut self) -&gt; Option&lt;T&gt;;

pub trait Compare&lt;L: ?Sized, R: ?Sized = L&gt; {
    fn compare(&amp;self, l: &amp;L, r: &amp;R) -&gt; Ordering;
    fn compares_lt(&amp;self, l: &amp;L, r: &amp;R) -&gt; bool { self.compare(l, r) == Less }
    fn compares_le(&amp;self, l: &amp;L, r: &amp;R) -&gt; bool { self.compare(l, r) != Greater }
    fn compares_ge(&amp;self, l: &amp;L, r: &amp;R) -&gt; bool { self.compare(l, r) != Less }
    fn compares_gt(&amp;self, l: &amp;L, r: &amp;R) -&gt; bool { self.compare(l, r) == Greater }
    fn compares_eq(&amp;self, l: &amp;L, r: &amp;R) -&gt; bool { self.compare(l, r) == Equal }
    fn compares_ne(&amp;self, l: &amp;L, r: &amp;R) -&gt; bool { self.compare(l, r) != Equal }
}

```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

暂无

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 简介](#51-简介)  

- binary-heap库和compare库目前只在merge_sort中使用
- merge_sort使用场景：排序时需要写盘的场景，分布式场景px_receiver需要对有序数据归并排序
- merge_sort主要使用binary-heap库中以下方法：


```
pub fn from_vec_cmp(vec: Vec&lt;T&gt;, cmp: C) -&gt; Self;
pub unsafe fn replace_cmp_raw(&amp;mut self, cmp: C, rebuild: bool);
pub fn is_empty(&amp;self) -&gt; bool;
pub fn push(&amp;mut self, item: T);
pub fn pop(&amp;mut self) -&gt; Option&lt;T&gt;;

```

- compare库主要为bianry-heap提供比较的方法，可以同一套代码同时实现最大堆和最小堆，默认为最大堆


###   [5.2 算法详述](#52-算法详述)  

- binary-heap是二叉堆的实现，二叉堆又分为最大堆和最小堆，下面以最大堆为例介绍堆的实现算法（最小堆类似）。
- 数据结构（二叉堆表示方法）：


```
通常使用数组来存储堆中的元素。如果堆顶元素的下标为0，则堆顶元素的两个子节点分别为1和2
由于每个节点的子节点数都为2，因此可以通过计算得到，下标为n的节点的子节点的下标为2n+1和2n+2

```

- 堆算法：


```
堆的初始化（算法0）：建立堆时，需要从最后一个父节点往前遍历，每一个节点执行以下算法：
  - 将每一个节点的两个子节点最大的那个跟当前节点比较，如果比当前节点大则进行交换（保证当前节点比任意一个子节点大）。
  - 如果交换后的子节点还有子节点，则需要对进行交换的子节点再次执行上一步，直到不需要进行交换为止（此时以该节点为根的堆满足最大堆的性质）
上述算法遍历结束后整个数据结构就满足了堆的性质

堆的插入（算法1）：向堆中插入数据时，需要将该数据放入数组的末尾，并与其父节点进行比较，如果比父节点大则与父节点交换。交换后继续与其新的父节点比较，直至不需要进行交换为止。

取出堆顶数（算法2）：将堆顶的数和最后一个数进行交换，原本堆顶的数在数组末尾，可以直接取出。需要执行如下算法以维持堆的特性：
  - 以堆顶节点作为初始节点，对该节点的子节点进行比较，较大的子节点与该节点进行比较，如果比该节点大则交换。交换后再与新的子节点进行比较，直到不需要进行交换为止。

对于以上算法，已知该节点的正确位置在堆底，开源库使用了如下算法来加速（算法3）：
  - 以堆顶节点作为初始节点，与子节点中较大的节点进行交换，直到交换到最底层没有子节点为止。
  - 再将该节点与父节点进行比较，如果比父节点大则进行交换。直到节点小于父节点为止（与堆的插入算法相同）。
该算法省去了算法2中下沉时与子节点的比较。当节点沉到堆底再与父节点比较时，由于已知该节点的正确位置在堆底，该过程不会持续很多个循环。

```

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

- 在代码中增加ut，主要测试点：对新增的接口进行测试


##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。不涉及资料改动

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*