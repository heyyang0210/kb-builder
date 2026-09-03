Created by 李嘉瑞, last modified by  林博 on 一月 23, 2024

IR链接：    [YDBRD-11530](https://jira.yasdb.com/browse/YDBRD-11530?src=confmacro)    -  HashTable优化  完成  / SR链接：    [YDBRD-13174](https://jira.yasdb.com/browse/YDBRD-13174?src=confmacro)    -  [列存计算] 根据计划给的信息，优化hash table的内存使用  完成

##   [1. Overview（概述）](#1-overview概述)  

- 在做hash join时，当右表的数据量比较大而且重复度比较低的时候，hash table会需要使用比较大的连续内存，每次扩容都是成倍增加使用内存，开销很大。
- 本设计方案计划使用二维数组代替，扩容时增加固定容量，不再需要拷贝内存。


##   [2. Features（功能特性）](#2-features功能特性)  

- 当右表不重复行数较多时，使用二维动态数组存储hash table中的元素
- 根据优化器计算出的信息在一开始确定hash table的大小，尽量减少扩容次数


##   [3. Interfaces（接口）](#3-interfaces接口)  

- 新增隐藏配置参数：
    - _COLUMNAR_MAX_HASH_BUCKET 最大hash bucket数，表示执行所能接受的最大hash bucket数（对应hash join右表的distinct行数），hash table的初始bucket数量不会超过这个参数，防止因统计信息不准导致执行使用过大内存。默认值 40000000，范围1024-uint最大值
    - _COLUMNAR_DYNAMIC_ARRAY_THRESHOLD 使用二维动态数组的阈值，如果统计信息给的build表行数不超过这个值，仍使用原来的vec，否则使用二维动态数组。 默认值 4000000，范围1024-uint最大值
    - _USE_OPTMZ_INFO 是否使用优化器提供的信息，参数为boolean类型，默认值为true，设为false则不使用优化器提供的信息对执行进行优化


```
pub trait DynArray&lt;T: Debug, A: Allocator + Clone&gt;: Index&lt;usize&gt; + IndexMut&lt;usize&gt; + Debug + Sized {
    fn try_with_elements_in(len: usize, element: T, alloc: A) -&gt; Result&lt;Self&gt;
    where
        T: Copy;
    fn try_extend(&amp;mut self, len: usize, element: T) -&gt; Result&lt;()&gt;
    where
        T: Copy;
    fn try_with_capacity_alloc(capacity: usize, alloc: A) -&gt; Result&lt;Self&gt;;
    fn len(&amp;self) -&gt; usize;
    fn capacity(&amp;self) -&gt; usize;
    fn is_empty(&amp;self) -&gt; bool;
    fn try_push(&amp;mut self, value: T) -&gt; Result&lt;()&gt;;
    fn fill_with(&amp;mut self, value: T)
    where
        T: Clone;
    fn clear(&amp;mut self);
    fn iter&lt;'a&gt;(&amp;'a self) -&gt; Box&lt;dyn Iterator&lt;Item = &amp;'a T&gt; + 'a&gt;;
    /// # Safety
    /// Callers have to ensure the `index` is not out of boundary.
    unsafe fn get_unchecked(&amp;self, index: usize) -&gt; &amp;T;
    /// # Safety
    /// Callers have to ensure the `index` is not out of boundary.
    unsafe fn get_unchecked_mut(&amp;mut self, index: usize) -&gt; &amp;mut T;
}

```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

- 暂无


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 二维动态数组](#51-二维动态数组)  

- 由若干个一维数组组成，所有一维数组的首地址按照分配顺序保存在一个动态数组中，其中每一个一维数组的容量固定， 以便于可以通过计算快速定位某一元素的位置。
- 通过记录一些数组相关的状态信息（如长度、每个一维数组的容量、可用的一维数组数量等），可以很容易定位到下一个元素插入的位置，以及计算有多少空余空间等。


###   [5.2 数据结构](#52-数据结构)  

```
pub struct Vec2D&lt;T, A: Allocator + Clone&gt; {
    alloc: A,
    array_offset_mask: usize,
    array_len_bit: usize,
    array_ptr: *mut *mut T,
    free_array_start: usize,
    free_array_end: usize,
    array_ptr_len: usize,
    capacity: usize,
    len: usize,
    _mark: PhantomData&lt;T&gt;,
}

```

###   [5.3 优缺点](#53-优缺点)  

- 二维动态数组在每次访问时都需要二次寻址
- 传统的vec在每次扩容时需要把所有的元素全部拷贝一遍，二维动态数组大部分情况下只需要直接分配固定大小内存使用即可，当存储一维数组首地址的内存不足时，只需要申请一块更大的内存拷贝数组的首地址即可


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。不涉及资料内容修改

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Comments:

|  [](null)  ,是否使用二维数组根据行数确定，非distinct值,隐藏参数加下划线,并行时统计信息给的值需要除以并行度,当内存不足时，需要先申请配额，无法申请足够的内存时，也不能超过内存使用限制,在autotrace中增加相关信息,可以构造一些相关场景测试,Posted by lijiarui at 五月 06, 2023 15:06|
|---|
