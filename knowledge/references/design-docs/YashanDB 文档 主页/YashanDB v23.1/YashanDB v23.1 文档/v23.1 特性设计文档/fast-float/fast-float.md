Created by 李嘉瑞, last modified on 三月 16, 2023

#   [YDBRD-7668 : fast-float Design（fast-float方案设计）](#ydbrd-7668--fast-float-designfast-float方案设计)  

SR链接：    [https://jira.yasdb.com/browse/YDBRD-7668](https://jira.yasdb.com/browse/YDBRD-7668)  

##   [1. Overview（概述）](#1-overview概述)  

- 整改开源库，去掉crab中的fast-float依赖


##   [2. Features（功能特性）](#2-features功能特性)  

- 实现从字符串到浮点数的解析


##   [3. Interfaces（接口）](#3-interfaces接口)  

```
fn from_str(src: &amp;str) -&gt; Result&lt;Self, ParseFloatError&gt; {
    dec2flt(src)
}

```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

暂无

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 简介](#51-简介)  

- 在看浮点数解析算法之前，需要先了解浮点数存储的原理：    [浮点数类型的存储原理](https://blog.csdn.net/zhoupian/article/details/125808129)  
- 浮点数解析使用了Eisel-Lemire算法，论文原文：    [Eisel-Lemire算法论文](https://arxiv.org/pdf/2101.11408.pdf)  
- 以下是对算法中的理论基础做一些简单介绍：


```
- 首先，我们需要了解，该算法是为了更快将字符串转换成浮点数。
    不管是什么形式的浮点数，都可以用以下形式表示：w * 10^q,其中w和q都是整数。（我们可以很容易理解将字符串转为该形式的过程，不再赘述）
- 其次，我们需要知道，根据浮点型的存储原理，我们需要将原始数据转换成 m * 2^e的形式，且m∈[1,2)。

- w * 10^q可以改写成w * 5^q * 2^q = m * 2^e。因此我们可以得出，m = w * 5^q * 2^p，其中p未知，我们只需要计算出w * 5^q，由于对2的乘除可以通过移位实现，我们只需要对乘法的结果移位到对应范围即可。
    由于转换过程中使用了u64作为中间值，且转换涉及四舍五入等，中间的实际过程较为复杂。

```

- 对于指数的转换如下：


![](https://pingcode.yasdb.com/atlas/files/public/67396a30a1ad9a3311dc7b69/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE1OTcsImV4cCI6MTc4MjIyMjM5N30.dc2jMy2AIM0bFMr3m6jRC7N41CXHHJ50p_f1kyQTL1g)

- 在2021年9月，rust已经将Eisel-Lemire算法写入了标准库。再加上该算法核心原理较为复杂，因此我们目前采用使用标准库直接代替的策略。


###   [5.2 性能对比](#52-性能对比)  

- fast-float crate


```
test bench_cast_utf8_sci_to_float                    ... bench:      23,318 ns/iter (+/- 986)
test bench_cast_utf8_to_float                        ... bench:      45,612 ns/iter (+/- 423)

test bench_cast_utf8_sci_to_float                    ... bench:      23,309 ns/iter (+/- 243)
test bench_cast_utf8_to_float                        ... bench:      45,475 ns/iter (+/- 320)

test bench_cast_utf8_sci_to_float                    ... bench:      23,332 ns/iter (+/- 191)
test bench_cast_utf8_to_float                        ... bench:      45,620 ns/iter (+/- 852)

```

- 标准库


```
test bench_cast_utf8_sci_to_float                    ... bench:      31,449 ns/iter (+/- 520)
test bench_cast_utf8_to_float                        ... bench:      58,175 ns/iter (+/- 739)

test bench_cast_utf8_sci_to_float                    ... bench:      31,211 ns/iter (+/- 480)
test bench_cast_utf8_to_float                        ... bench:      58,461 ns/iter (+/- 1,300)

test bench_cast_utf8_sci_to_float                    ... bench:      31,288 ns/iter (+/- 344)
test bench_cast_utf8_to_float                        ... bench:      58,680 ns/iter (+/- 576)

```

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

##   [7.参考资料](#7参考资料)  

-   [浮点数类型的存储原理](https://blog.csdn.net/zhoupian/article/details/125808129)  
-   [Eisel-Lemire算法论文](https://arxiv.org/pdf/2101.11408.pdf)  
-   [rust日报](https://rustcc.cn/article?id=c36da117-d84e-42a0-9304-b02fe6f27df1)  


##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments: