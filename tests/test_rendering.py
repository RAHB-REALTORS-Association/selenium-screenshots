import unittest
from unittest.mock import patch
from rendering import wait_for_render


class Clock:
    def __init__(self):
        self.now = 0

    def monotonic(self):
        return self.now

    def sleep(self, seconds):
        self.now += seconds


class Driver:
    def __init__(self, animated=False, changing=False):
        self.animated = animated
        self.changing = changing
        self.frames = 0

    def execute_async_script(self, script):
        return {'animated': self.animated}

    def get_screenshot_as_png(self):
        self.frames += 1
        return str(self.frames).encode() if self.changing else b'stable image'


class RenderTests(unittest.TestCase):
    def test_static_page_settles_without_full_budget(self):
        clock = Clock()
        with patch('rendering.time', clock):
            wait_for_render(Driver())
        self.assertGreaterEqual(clock.now, 2)
        self.assertLess(clock.now, 4)

    def test_initially_blank_canvas_gets_time_to_render(self):
        clock = Clock()
        with patch('rendering.time', clock):
            wait_for_render(Driver(animated=True))
        self.assertGreaterEqual(clock.now, 8)
        self.assertLessEqual(clock.now, 12)

    def test_infinite_animation_is_bounded(self):
        clock = Clock()
        with patch('rendering.time', clock):
            wait_for_render(Driver(animated=True, changing=True))
        self.assertEqual(clock.now, 12)
